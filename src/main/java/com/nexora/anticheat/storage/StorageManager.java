package com.nexora.anticheat.storage;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.punishment.BanRecord;
import com.nexora.anticheat.punishment.IpBanRecord;
import com.nexora.anticheat.util.TaskUtil;
import org.bukkit.configuration.file.FileConfiguration;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;

/**
 * Manages asynchronous logging to files and database persistence.
 */
public class StorageManager {

    private final NexoraPlugin plugin;
    private DatabaseStorage database;
    private File logFile;

    public StorageManager(@NotNull NexoraPlugin plugin) {
        this.plugin = plugin;
    }

    public void init() {
        FileConfiguration config = plugin.getConfigManager().getConfig();
        String type = config.getString("storage.type", "SQLITE").toUpperCase();

        try {
            if ("MYSQL".equals(type)) {
                String host = config.getString("storage.mysql.host", "localhost");
                int port = config.getInt("storage.mysql.port", 3306);
                String databaseName = config.getString("storage.mysql.database", "anticheat");
                String user = config.getString("storage.mysql.username", "root");
                String pass = config.getString("storage.mysql.password", "");
                int poolSize = config.getInt("storage.mysql.pool.maximum-pool-size", 10);

                this.database = new MySQLStorage(host, port, databaseName, user, pass, poolSize);
            } else {
                File dbFile = new File(plugin.getDataFolder(), config.getString("storage.sqlite.file-name", "bayon_violations.db"));
                this.database = new SQLiteStorage(dbFile);
            }
            this.database.init();
            plugin.getLogger().info("Successfully initialized " + type + " storage backend.");
        } catch (Exception ex) {
            plugin.getLogger().log(Level.SEVERE, "Failed to initialize database storage, falling back to SQLite: " + ex.getMessage(), ex);
            try {
                this.database = new SQLiteStorage(new File(plugin.getDataFolder(), "bayon_violations.db"));
                this.database.init();
            } catch (Exception fallbackEx) {
                plugin.getLogger().log(Level.SEVERE, "Failed to initialize fallback SQLite storage!", fallbackEx);
            }
        }

        // Initialize log file
        File logsDir = new File(plugin.getDataFolder(), "logs");
        if (!logsDir.exists()) {
            logsDir.mkdirs();
        }
        this.logFile = new File(logsDir, "violations.log");

        // Warm up recorded player names cache
        refreshPlayerNamesCache();
    }

    private final java.util.Set<String> cachedPlayerNames = java.util.concurrent.ConcurrentHashMap.newKeySet();

    public void refreshPlayerNamesCache() {
        TaskUtil.runAsync(plugin, () -> {
            try {
                if (database != null) {
                    cachedPlayerNames.addAll(database.getRecordedPlayerNames());
                }
            } catch (Exception ignored) {
            }
        });
    }

    public java.util.Set<String> getCachedPlayerNames() {
        return java.util.Collections.unmodifiableSet(cachedPlayerNames);
    }

    public void logViolationAsync(@NotNull ViolationRecord record) {
        cachedPlayerNames.add(record.playerName());
        TaskUtil.runAsync(plugin, () -> {
            if (database != null) {
                try {
                    database.logViolation(record);
                } catch (Exception ex) {
                    plugin.getLogger().warning("Failed to persist violation record to DB: " + ex.getMessage());
                }
            }

            if (logFile != null) {
                try (FileWriter fw = new FileWriter(logFile, true);
                     PrintWriter pw = new PrintWriter(fw)) {
                    pw.printf("[%s] [VL: %.1f] %s (%s) failed %s: %s (Ping: %dms)%n",
                            record.formattedTime(),
                            record.vl(),
                            record.playerName(),
                            record.playerUuid(),
                            record.checkId(),
                            record.details(),
                            record.ping());
                } catch (Exception ignored) {
                }
            }
        });
    }

    public CompletableFuture<List<ViolationRecord>> getHistoryAsync(@NotNull UUID playerUuid, int limit) {
        CompletableFuture<List<ViolationRecord>> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                future.complete(database != null ? database.getHistory(playerUuid, limit) : List.of());
            } catch (Exception ex) {
                plugin.getLogger().warning("Failed to fetch violation history: " + ex.getMessage());
                future.complete(List.of());
            }
        });
        return future;
    }

    public CompletableFuture<List<ViolationRecord>> getHistoryByNameAsync(@NotNull String playerName, int limit) {
        CompletableFuture<List<ViolationRecord>> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                future.complete(database != null ? database.getHistoryByName(playerName, limit) : List.of());
            } catch (Exception ex) {
                plugin.getLogger().warning("Failed to fetch violation history by name: " + ex.getMessage());
                future.complete(List.of());
            }
        });
        return future;
    }

    // --- Ban Async Operations ---

    public CompletableFuture<Void> saveBanAsync(@NotNull BanRecord record) {
        CompletableFuture<Void> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                if (database != null) {
                    database.saveBan(record);
                }
                future.complete(null);
            } catch (Exception ex) {
                plugin.getLogger().warning("Failed to save ban record: " + ex.getMessage());
                future.completeExceptionally(ex);
            }
        });
        return future;
    }

    public CompletableFuture<BanRecord> getActiveBanAsync(@NotNull UUID playerUuid) {
        CompletableFuture<BanRecord> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                future.complete(database != null ? database.getActiveBan(playerUuid) : null);
            } catch (Exception ex) {
                plugin.getLogger().warning("Failed to get active ban: " + ex.getMessage());
                future.complete(null);
            }
        });
        return future;
    }

    public CompletableFuture<BanRecord> getActiveBanByNameAsync(@NotNull String playerName) {
        CompletableFuture<BanRecord> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                future.complete(database != null ? database.getActiveBanByName(playerName) : null);
            } catch (Exception ex) {
                plugin.getLogger().warning("Failed to get active ban by name: " + ex.getMessage());
                future.complete(null);
            }
        });
        return future;
    }

    public CompletableFuture<List<BanRecord>> getBanHistoryAsync(@NotNull UUID playerUuid, int limit) {
        CompletableFuture<List<BanRecord>> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                future.complete(database != null ? database.getBanHistory(playerUuid, limit) : List.of());
            } catch (Exception ex) {
                plugin.getLogger().warning("Failed to get ban history: " + ex.getMessage());
                future.complete(List.of());
            }
        });
        return future;
    }

    public CompletableFuture<List<BanRecord>> getBanHistoryByNameAsync(@NotNull String playerName, int limit) {
        CompletableFuture<List<BanRecord>> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                future.complete(database != null ? database.getBanHistoryByName(playerName, limit) : List.of());
            } catch (Exception ex) {
                plugin.getLogger().warning("Failed to get ban history by name: " + ex.getMessage());
                future.complete(List.of());
            }
        });
        return future;
    }

    public CompletableFuture<Void> unbanPlayerAsync(@NotNull String playerNameOrUuid) {
        CompletableFuture<Void> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                if (database != null) {
                    try {
                        UUID uuid = UUID.fromString(playerNameOrUuid);
                        database.deactivateBansForPlayer(uuid);
                        database.resetKickCount(uuid);
                    } catch (IllegalArgumentException e) {
                        database.deactivateBansForPlayerName(playerNameOrUuid);
                        database.resetKickCountByName(playerNameOrUuid);
                    }
                }
                future.complete(null);
            } catch (Exception ex) {
                plugin.getLogger().warning("Failed to unban player: " + ex.getMessage());
                future.completeExceptionally(ex);
            }
        });
        return future;
    }

    // --- IP Ban Async Operations ---

    public CompletableFuture<Void> saveIpBanAsync(@NotNull IpBanRecord record) {
        CompletableFuture<Void> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                if (database != null) {
                    database.saveIpBan(record);
                }
                future.complete(null);
            } catch (Exception ex) {
                plugin.getLogger().warning("Failed to save IP ban: " + ex.getMessage());
                future.completeExceptionally(ex);
            }
        });
        return future;
    }

    public CompletableFuture<IpBanRecord> getActiveIpBanAsync(@NotNull String ipAddress) {
        CompletableFuture<IpBanRecord> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                future.complete(database != null ? database.getActiveIpBan(ipAddress) : null);
            } catch (Exception ex) {
                plugin.getLogger().warning("Failed to get active IP ban: " + ex.getMessage());
                future.complete(null);
            }
        });
        return future;
    }

    public CompletableFuture<Void> unbanIpAsync(@NotNull String ipAddress) {
        CompletableFuture<Void> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                if (database != null) {
                    database.deactivateIpBan(ipAddress);
                }
                future.complete(null);
            } catch (Exception ex) {
                plugin.getLogger().warning("Failed to unban IP: " + ex.getMessage());
                future.completeExceptionally(ex);
            }
        });
        return future;
    }

    // --- Kick Counter Operations ---

    public CompletableFuture<Integer> getKickCountAsync(@NotNull UUID playerUuid) {
        CompletableFuture<Integer> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                future.complete(database != null ? database.getKickCount(playerUuid) : 0);
            } catch (Exception ex) {
                future.complete(0);
            }
        });
        return future;
    }

    public CompletableFuture<Void> incrementKickCountAsync(@NotNull UUID playerUuid, @NotNull String playerName) {
        CompletableFuture<Void> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                if (database != null) {
                    database.incrementKickCount(playerUuid, playerName);
                }
                future.complete(null);
            } catch (Exception ignored) {
                future.complete(null);
            }
        });
        return future;
    }

    public CompletableFuture<Void> resetKickCountAsync(@NotNull UUID playerUuid) {
        CompletableFuture<Void> future = new CompletableFuture<>();
        TaskUtil.runAsync(plugin, () -> {
            try {
                if (database != null) {
                    database.resetKickCount(playerUuid);
                }
                future.complete(null);
            } catch (Exception ignored) {
                future.complete(null);
            }
        });
        return future;
    }

    @Nullable
    public DatabaseStorage getDatabase() {
        return database;
    }

    public void close() {
        if (database != null) {
            database.close();
        }
    }
}
