package com.nexora.anticheat.api;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.Collections;
import java.util.Map;

/**
 * Public developer API for Nexora AntiCheat.
 */
public final class NexoraAPI {

    private static NexoraPlugin plugin;

    private NexoraAPI() {
        // Singleton API access
    }

    /**
     * Internal initialization by plugin lifecycle.
     */
    public static void init(@NotNull NexoraPlugin instance) {
        plugin = instance;
    }

    /**
     * Gets the current violation level of a player for a specific check.
     *
     * @param player  The player to inspect.
     * @param checkId The ID of the check.
     * @return The current violation level, or 0.0 if not tracked.
     */
    public static double getViolationLevel(@NotNull Player player, @NotNull String checkId) {
        if (plugin == null) return 0.0;
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        return data != null ? data.getViolationLevel(checkId) : 0.0;
    }

    /**
     * Gets the sum of all active violation levels across all checks for a player.
     *
     * @param player Target player.
     * @return Total violation level.
     */
    public static double getTotalViolationLevel(@NotNull Player player) {
        if (plugin == null) return 0.0;
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        return data != null ? data.getTotalViolationLevel() : 0.0;
    }

    /**
     * Gets an unmodifiable map of all violation levels for a player.
     *
     * @param player Target player.
     * @return Map of check ID to VL.
     */
    @NotNull
    public static Map<String, Double> getAllViolations(@NotNull Player player) {
        if (plugin == null) return Collections.emptyMap();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        return data != null ? data.getViolations() : Collections.emptyMap();
    }

    /**
     * Checks if a player is currently exempted from detections.
     *
     * @param player Target player.
     * @return True if exempt.
     */
    public static boolean isExempt(@NotNull Player player) {
        if (plugin == null) return false;
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        return data != null && data.isExempt();
    }

    /**
     * Temporarily exempts a player from all anti-cheat detections.
     *
     * @param player     Target player.
     * @param durationMs Duration of exemption in milliseconds.
     */
    public static void setExempt(@NotNull Player player, long durationMs) {
        if (plugin == null) return;
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data != null) {
            data.setExemption(durationMs);
        }
    }

    /**
     * Clears any active temporary exemption on a player.
     *
     * @param player Target player.
     */
    public static void removeExemption(@NotNull Player player) {
        if (plugin == null) return;
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data != null) {
            data.clearExemption();
        }
    }

    /**
     * Clears all active violation levels for a player.
     *
     * @param player Target player.
     */
    public static void resetViolations(@NotNull Player player) {
        if (plugin == null) return;
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data != null) {
            data.resetViolations();
        }
    }
}
