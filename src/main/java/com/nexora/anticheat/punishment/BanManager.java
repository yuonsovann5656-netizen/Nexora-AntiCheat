package com.nexora.anticheat.punishment;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.TaskUtil;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;
import org.bukkit.event.player.PlayerLoginEvent;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.net.InetAddress;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages progressive bans, IP bans, kick-escalation tiers, and cracked-player enforcement.
 */
public class BanManager implements Listener {

    private final NexoraPlugin plugin;

    // Cache to prevent excessive DB queries during quick reconnects
    private final Map<UUID, BanRecord> activeBansCache = new ConcurrentHashMap<>();
    private final Map<String, IpBanRecord> activeIpBansCache = new ConcurrentHashMap<>();

    // Tier durations in milliseconds
    private static final long TIER_1_DURATION = 24L * 60 * 60 * 1000L;         // 24 Hours
    private static final long TIER_2_DURATION = 7L * 24 * 60 * 60 * 1000L;      // 7 Days
    private static final long TIER_3_DURATION = 30L * 24 * 60 * 60 * 1000L;     // 30 Days

    public BanManager(@NotNull NexoraPlugin plugin) {
        this.plugin = plugin;
    }

    /**
     * Inspects incoming logins to enforce active UUID bans, IP bans, and cracked-client policies.
     */
    @EventHandler(priority = EventPriority.LOWEST)
    public void onPreLogin(AsyncPlayerPreLoginEvent event) {
        UUID uuid = event.getUniqueId();
        String name = event.getName();
        InetAddress address = event.getAddress();
        String ip = address != null ? address.getHostAddress() : null;

        FileConfiguration config = plugin.getConfigManager().getConfig();

        // 1. Cracked Player Detection (if enabled and server is online-mode)
        boolean crackedDetectionEnabled = config.getBoolean("settings.cracked-detection.enabled", true);
        boolean serverIsOfflineMode = config.getBoolean("settings.cracked-detection.server-is-offline-mode", false);

        if (crackedDetectionEnabled && !serverIsOfflineMode && Bukkit.getOnlineMode()) {
            boolean isCracked = uuid.version() == 3;
            if (isCracked) {
                boolean permanentBan = config.getBoolean("settings.cracked-detection.permanent-ban-cracked", true);
                if (permanentBan) {
                    // Issue permanent ban + IP ban immediately
                    executeBanInternal(uuid, name, ip, "Cracked/Offline client detected on online-mode server", "CrackedDetection", "NexoraAC", 4, -1L);
                    if (ip != null) {
                        executeIpBanInternal(ip, uuid, name, "Cracked/Offline client detected", "NexoraAC");
                    }

                    // Dispatch Discord alert
                    dispatchDiscordPunishment(name, uuid.toString(), "BAN", "Permanent (Lifetime)", "CrackedDetection", "SECURITY", 999.0,
                            "Detected offline-mode UUID version 3 on an online-mode server. Permanent IP ban applied.", 0, 20.0, "Cracked/Offline", true, ip);

                    Component kickMsg = plugin.getConfigManager().getMessages().getComponent(
                            "punish.cracked-ban",
                            "<#FF0000><bold>NEXORA SECURITY</bold></#FF0000>\n\n<red>Premium Mojang account required.\nOffline / cracked clients are forbidden on this server.</red>",
                            Map.of()
                    );
                    event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_BANNED, kickMsg);
                    return;
                } else {
                    Component kickMsg = plugin.getConfigManager().getMessages().getComponent(
                            "punish.cracked-kick",
                            "<#FF0000><bold>NEXORA SECURITY</bold></#FF0000>\n\n<red>Premium Mojang account required.\nPlease buy Minecraft at minecraft.net.</red>",
                            Map.of()
                    );
                    event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER, kickMsg);
                    return;
                }
            }
        }

        // 2. Enforce IP Ban
        if (ip != null) {
            try {
                IpBanRecord ipBan = plugin.getStorageManager().getDatabase() != null
                        ? plugin.getStorageManager().getDatabase().getActiveIpBan(ip)
                        : null;
                if (ipBan != null) {
                    Component ipBanMsg = plugin.getConfigManager().getMessages().getComponent(
                            "punish.ip-ban-screen",
                            "<#FF0000><bold>NEXORA ANTICHEAT</bold></#FF0000>\n\n<red>Your IP address is permanently banned.</red>\n<gray>Reason: <yellow><reason></yellow></gray>\n<gray>Banned by: <white><banner></white></gray>",
                            Map.of("reason", ipBan.reason(), "banner", ipBan.bannedBy())
                    );
                    event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_BANNED, ipBanMsg);
                    return;
                }
            } catch (Exception ignored) {
            }
        }

        // 3. Enforce UUID Ban
        try {
            BanRecord ban = plugin.getStorageManager().getDatabase() != null
                    ? plugin.getStorageManager().getDatabase().getActiveBan(uuid)
                    : null;
            if (ban != null) {
                if (ban.isExpired()) {
                    // Ban expired — deactivate
                    plugin.getStorageManager().getDatabase().deactivateBansForPlayer(uuid);
                } else {
                    Map<String, String> placeholders = Map.of(
                            "reason", ban.reason(),
                            "duration", ban.tierDescription(),
                            "expires", ban.formattedExpiresAt(),
                            "banned_at", ban.formattedBannedAt(),
                            "banner", ban.bannedBy()
                    );
                    Component banMsg = plugin.getConfigManager().getMessages().getComponent(
                            "punish.ban-screen",
                            "<#FF0000><bold>NEXORA ANTICHEAT</bold></#FF0000>\n\n<red>You are banned from this server.</red>\n<gray>Reason: <yellow><reason></yellow>\nDuration: <aqua><duration></aqua>\nExpires: <gold><expires></gold>\nAppeal at our community Discord.</gray>",
                            placeholders
                    );
                    event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_BANNED, banMsg);
                }
            }
        } catch (Exception ignored) {
        }
    }

    /**
     * Handles punishment execution for kick violations, evaluating progressive ban thresholds.
     */
    public void processViolationKick(@NotNull Player player,
                                     @NotNull PlayerData data,
                                     @NotNull String checkId,
                                     double vl,
                                     @NotNull String details) {
        FileConfiguration config = plugin.getConfigManager().getConfig();
        boolean progressiveBans = config.getBoolean("settings.progressive-bans.enabled", true);
        int kicksBeforeBan = config.getInt("settings.progressive-bans.kicks-before-ban", 3);

        String ip = player.getAddress() != null ? player.getAddress().getAddress().getHostAddress() : null;
        UUID uuid = player.getUniqueId();
        String name = player.getName();
        boolean isCracked = uuid.version() == 3;
        String clientBrand = data.getClientBrand();
        int ping = player.getPing();
        double tps = Math.min(20.0, Math.round(Bukkit.getTPS()[0] * 10.0) / 10.0);

        if (!progressiveBans) {
            // Standard single kick
            kickPlayer(player, checkId, vl, 1, 1);
            dispatchDiscordPunishment(name, uuid.toString(), "KICK", null, checkId, "COMBAT", vl, details, ping, tps, clientBrand, isCracked, ip);
            return;
        }

        // Query current kick count asynchronously, then act
        plugin.getStorageManager().getKickCountAsync(uuid).thenAccept(currentKicks -> {
            int newKickCount = currentKicks + 1;
            plugin.getStorageManager().incrementKickCountAsync(uuid, name);

            if (newKickCount >= kicksBeforeBan) {
                // Progressive Ban Escalation!
                plugin.getStorageManager().getBanHistoryAsync(uuid, 50).thenAccept(banHistory -> {
                    int previousBanCount = banHistory.size();
                    int tier = Math.min(4, previousBanCount + 1);

                    Long durationMs = switch (tier) {
                        case 1 -> TIER_1_DURATION;
                        case 2 -> TIER_2_DURATION;
                        case 3 -> TIER_3_DURATION;
                        default -> null; // Permanent
                    };

                    String durationText = switch (tier) {
                        case 1 -> "24 Hours";
                        case 2 -> "7 Days";
                        case 3 -> "30 Days";
                        default -> "Permanent / Lifetime";
                    };

                    executeBanInternal(uuid, name, ip, "Exceeded maximum violation kicks (" + checkId + ")", checkId, "NexoraAC", tier, durationMs != null ? durationMs : -1L);

                    // IP Ban on permanent ban tier
                    boolean ipBanOnPerm = config.getBoolean("settings.bans.ip-ban-on-permanent", true);
                    if (tier >= 4 && ipBanOnPerm && ip != null) {
                        executeIpBanInternal(ip, uuid, name, "Permanent ban reached (Tier 4)", "NexoraAC");
                    }

                    // Reset kick count after ban
                    plugin.getStorageManager().resetKickCountAsync(uuid);

                    // Execute on entity thread
                    TaskUtil.runEntity(plugin, player, () -> {
                        Map<String, String> placeholders = Map.of(
                                "player", name,
                                "check", checkId,
                                "duration", durationText,
                                "tier", String.valueOf(tier)
                        );

                        Component banReason = plugin.getConfigManager().getMessages().getComponent(
                                "punish.progressive-ban-screen",
                                "<#FF0000><bold>NEXORA ANTICHEAT</bold></#FF0000>\n\n<red>You have been banned for suspicious modifications.</red>\n<gray>Check: <yellow><check></yellow>\nDuration: <aqua><duration></aqua> (Tier <tier>/4)\nExpires: Automatically after duration expires.</gray>",
                                placeholders
                        );
                        player.kick(banReason);

                        Component broadcast = plugin.getConfigManager().getMessages().getComponent(
                                "punish.ban-broadcast",
                                "<prefix><red><player></red> <gray>was banned by <#FF0000>Nexora</#FF0000> for <aqua><duration></aqua> (<yellow><check></yellow>).</gray>",
                                placeholders
                        );
                        Bukkit.broadcast(broadcast);
                    });

                    // Dispatch Discord alert
                    dispatchDiscordPunishment(name, uuid.toString(), "BAN", durationText + " (Tier " + tier + ")", checkId, "ANTICHEAT", vl, details, ping, tps, clientBrand, isCracked, ip);
                });
            } else {
                // Warning kick (not yet banned)
                TaskUtil.runEntity(plugin, player, () -> {
                    kickPlayer(player, checkId, vl, newKickCount, kicksBeforeBan);
                });
                dispatchDiscordPunishment(name, uuid.toString(), "KICK", "Warning " + newKickCount + "/" + kicksBeforeBan, checkId, "ANTICHEAT", vl, details, ping, tps, clientBrand, isCracked, ip);
            }
        });
    }

    private void kickPlayer(@NotNull Player player, @NotNull String checkId, double vl, int currentKick, int maxKicks) {
        Map<String, String> placeholders = Map.of(
                "player", player.getName(),
                "check", checkId,
                "vl", String.format("%.1f", vl),
                "kicks", String.valueOf(currentKick),
                "max_kicks", String.valueOf(maxKicks)
        );

        Component kickReason = plugin.getConfigManager().getMessages().getComponent(
                "punish.progressive-kick-reason",
                "<#FF0000><bold>NEXORA ANTICHEAT</bold></#FF0000>\n\n<red>Disconnected for suspicious gameplay (<yellow><check></yellow>).</red>\n<yellow>Warning: <gold><kicks></gold>/<gold><max_kicks></gold> kicks before an automatic ban!</yellow>",
                placeholders
        );
        player.kick(kickReason);

        Component broadcast = plugin.getConfigManager().getMessages().getComponent(
                "punish.kick-broadcast",
                "<prefix><red><player></red> <gray>was kicked by <#FF0000>Nexora</#FF0000> (<yellow><check></yellow> | Kick <kicks>/<max_kicks>).</gray>",
                placeholders
        );
        Bukkit.broadcast(broadcast);
    }

    public void executeBanInternal(@NotNull UUID uuid,
                                   @NotNull String playerName,
                                   @Nullable String ipAddress,
                                   @NotNull String reason,
                                   @Nullable String checkId,
                                   @NotNull String banner,
                                   int tier,
                                   long durationMs) {
        long now = System.currentTimeMillis();
        Long expiresAt = durationMs > 0 ? now + durationMs : null;
        Long durationObj = durationMs > 0 ? durationMs : null;

        BanRecord record = new BanRecord(
                0,
                uuid,
                playerName,
                reason,
                checkId,
                banner,
                now,
                expiresAt,
                durationObj,
                tier,
                true,
                ipAddress
        );

        plugin.getStorageManager().saveBanAsync(record);
    }

    public void executeIpBanInternal(@NotNull String ipAddress,
                                     @Nullable UUID uuid,
                                     @Nullable String playerName,
                                     @NotNull String reason,
                                     @NotNull String banner) {
        IpBanRecord record = new IpBanRecord(
                0,
                ipAddress,
                uuid,
                playerName,
                reason,
                System.currentTimeMillis(),
                banner,
                true
        );
        plugin.getStorageManager().saveIpBanAsync(record);
    }

    public void unbanPlayer(@NotNull String target) {
        plugin.getStorageManager().unbanPlayerAsync(target);
    }

    public void unbanIp(@NotNull String ipAddress) {
        plugin.getStorageManager().unbanIpAsync(ipAddress);
    }

    private void dispatchDiscordPunishment(@NotNull String playerName,
                                           @NotNull String playerUuid,
                                           @NotNull String action,
                                           @Nullable String durationText,
                                           @NotNull String checkId,
                                           @NotNull String category,
                                           double vl,
                                           @NotNull String details,
                                           int ping,
                                           double tps,
                                           @NotNull String clientBrand,
                                           boolean isCracked,
                                           @Nullable String ipAddress) {
        FileConfiguration config = plugin.getConfigManager().getConfig();
        if (!config.getBoolean("alerts.discord.enabled", false)) {
            return;
        }

        String webhookUrl = config.getString("alerts.discord.webhook-url", "");
        if (webhookUrl == null || webhookUrl.isBlank() || webhookUrl.contains("YOUR_WEBHOOK_URL_HERE")) {
            return;
        }

        boolean showIp = config.getBoolean("alerts.discord.show-ip-in-embed", false);
        int color = config.getInt("alerts.discord.embed-color", 16711680);

        plugin.getAlertManager().getDiscordSender().sendPunishmentAlertAsync(
                plugin,
                webhookUrl,
                playerName,
                playerUuid,
                action,
                durationText,
                checkId,
                category,
                vl,
                details,
                ping,
                tps,
                clientBrand,
                isCracked,
                ipAddress,
                showIp,
                color
        );
    }
}
