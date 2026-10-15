package com.nexora.anticheat.check;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.api.NexoraFlagEvent;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.punishment.PunishmentType;
import com.nexora.anticheat.storage.ViolationRecord;
import com.nexora.anticheat.util.BedrockUtil;
import org.bukkit.Bukkit;
import org.bukkit.GameMode;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.Listener;
import org.jetbrains.annotations.NotNull;

/**
 * Base abstract foundation for all anti-cheat detection modules.
 */
public abstract class Check implements Listener {

    protected final NexoraPlugin plugin;
    private final String id;
    private final String name;
    private final CheckCategory category;

    private boolean enabled = true;
    private double maxVl = 10.0;
    private double vlDecay = 1.0;
    private boolean setback = false;
    private PunishmentType punishment = PunishmentType.KICK;
    private boolean debug = false;

    public Check(@NotNull NexoraPlugin plugin,
                 @NotNull String id,
                 @NotNull String name,
                 @NotNull CheckCategory category) {
        this.plugin = plugin;
        this.id = id;
        this.name = name;
        this.category = category;
    }

    public void reloadConfig(@NotNull FileConfiguration config) {
        String path = category.name().toLowerCase() + "." + id.toLowerCase();
        this.enabled = config.getBoolean(path + ".enabled", true);
        this.maxVl = config.getDouble(path + ".max-vl", 10.0);
        this.vlDecay = config.getDouble(path + ".vl-decay", 1.0);
        this.setback = config.getBoolean(path + ".setback", false);
        this.punishment = PunishmentType.fromString(config.getString(path + ".punishment", "KICK"), PunishmentType.KICK);
        loadCustomConfig(config, path);
    }

    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        // Overridden by specific check implementations
    }

    /**
     * Determines whether checks should be skipped due to lag, network spikes, or immunity.
     */
    public boolean shouldSkip(@NotNull Player player, @NotNull PlayerData data) {
        if (!enabled) {
            return true;
        }

        if (player.getGameMode() == GameMode.CREATIVE || player.getGameMode() == GameMode.SPECTATOR) {
            return true;
        }

        FileConfiguration mainConfig = plugin.getConfigManager().getConfig();
        if (mainConfig.getBoolean("settings.ops-bypass", true) && player.isOp()) {
            return true;
        }

        if (player.hasPermission("nexora.bypass") || player.hasPermission("nexora.bypass." + id.toLowerCase())) {
            return true;
        }

        if (data.isExempt()) {
            return true;
        }

        // Bedrock / GeyserMC player — skip checks that are incompatible with Bedrock physics
        if (BedrockUtil.isBedrock(player)) {
            java.util.List<String> bedrockSkip = mainConfig.getStringList("settings.bedrock.skip-checks");
            if (bedrockSkip.stream().anyMatch(s -> s.equalsIgnoreCase(id))) {
                return true;
            }
        }

        if (mainConfig.getBoolean("settings.lag-compensation.enabled", true)) {
            // Server TPS Lag Compensation
            double minTps = mainConfig.getDouble("settings.lag-compensation.min-tps", 18.5);
            if (Bukkit.getTPS()[0] < minTps) {
                return true;
            }

            // Client Ping Network Spike Compensation
            int maxPing = mainConfig.getInt("settings.lag-compensation.max-ping-ms", 350);
            if (player.getPing() > maxPing) {
                return true;
            }

            long now = System.currentTimeMillis();

            // Teleport Immunity
            long teleportImmunityMs = mainConfig.getLong("settings.lag-compensation.teleport-immunity-ticks", 20L) * 50L;
            if (now - data.getLastTeleportTimestamp() < teleportImmunityMs) {
                return true;
            }

            // Respawn Immunity
            long respawnImmunityMs = mainConfig.getLong("settings.lag-compensation.respawn-immunity-ticks", 40L) * 50L;
            if (now - data.getLastRespawnTimestamp() < respawnImmunityMs) {
                return true;
            }

            // Join Immunity
            long joinImmunityMs = mainConfig.getLong("settings.lag-compensation.join-immunity-ticks", 60L) * 50L;
            if (now - data.getJoinTimestamp() < joinImmunityMs) {
                return true;
            }

            // Knockback / Velocity Immunity
            long velocityImmunityMs = mainConfig.getLong("settings.lag-compensation.velocity-immunity-ticks", 30L) * 50L;
            if (now - data.getLastVelocityTimestamp() < velocityImmunityMs) {
                return true;
            }
        }

        return false;
    }

    /**
     * Flags a player for an anti-cheat violation.
     */
    public void flag(@NotNull Player player, @NotNull PlayerData data, @NotNull String details, double addedVl) {
        double currentVl = data.getViolationLevel(id);
        double newTotalVl = currentVl + addedVl;

        NexoraFlagEvent flagEvent = new NexoraFlagEvent(player, id, category.getDisplayName(), addedVl, newTotalVl, details);
        Bukkit.getPluginManager().callEvent(flagEvent);

        if (flagEvent.isCancelled()) {
            return;
        }

        double resultingVl = data.addViolationLevel(id, addedVl);

        // Send staff alerts
        plugin.getAlertManager().sendAlert(player, id, category.getDisplayName(), resultingVl, maxVl, details);

        // Asynchronously log violation
        plugin.getStorageManager().logViolationAsync(new ViolationRecord(
                player.getUniqueId(),
                player.getName(),
                id,
                resultingVl,
                details,
                player.getPing(),
                System.currentTimeMillis()
        ));

        // Setback if enabled
        if (setback) {
            handleSetback(player, data);
        }

        // Execute punishment if threshold breached
        if (resultingVl >= maxVl) {
            plugin.getPunishmentManager().executePunishment(player, data, id, punishment, resultingVl);
        }
    }

    protected void handleSetback(@NotNull Player player, @NotNull PlayerData data) {
        plugin.getPunishmentManager().setback(player, data);
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public CheckCategory getCategory() {
        return category;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public double getMaxVl() {
        return maxVl;
    }

    public double getVlDecay() {
        return vlDecay;
    }

    public boolean isSetback() {
        return setback;
    }

    public PunishmentType getPunishment() {
        return punishment;
    }

    public boolean isDebug() {
        return debug;
    }

    public void setDebug(boolean debug) {
        this.debug = debug;
    }
}
