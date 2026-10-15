package com.nexora.anticheat.util;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Utility for detecting Bedrock (GeyserMC / Floodgate) players.
 *
 * <p>Detection priority:
 * <ol>
 *   <li>Floodgate API — most reliable; zero false-positives.</li>
 *   <li>Name prefix  — configurable string prepended by Geyser (default {@code "."}).</li>
 *   <li>Permission   — {@code nexora.bedrock} granted via Floodgate's group mapping.</li>
 * </ol>
 *
 * <p>Bedrock players receive relaxed thresholds on several checks because their client
 * physics differ from Java Edition (different tick rate handling, input latency, etc.).
 */
public final class BedrockUtil {

    private static final Logger LOG = Logger.getLogger("NexoraAC");

    /** Floodgate class name — loaded reflectively so the plugin starts without Floodgate. */
    private static final String FLOODGATE_API_CLASS = "org.geysermc.floodgate.api.FloodgateApi";

    private static boolean floodgatePresent = false;
    private static String bedrockPrefix = ".";

    /**
     * Cache of already-resolved Bedrock UUIDs to avoid repeated reflection calls per packet.
     * Entries are added on join, removed on quit.
     */
    private static final Set<UUID> bedrockCache = ConcurrentHashMap.newKeySet();

    private BedrockUtil() {}

    /**
     * Initialises the detector. Must be called once on plugin enable, before any players join.
     *
     * @param prefix configured Bedrock name prefix (e.g. {@code "."})
     */
    public static void init(@NotNull String prefix) {
        bedrockPrefix = prefix == null ? "." : prefix;
        try {
            Class.forName(FLOODGATE_API_CLASS);
            floodgatePresent = true;
            LOG.info("[NexoraAC] Floodgate detected — Bedrock player detection via Floodgate API enabled.");
        } catch (ClassNotFoundException e) {
            if (!bedrockPrefix.isEmpty()) {
                LOG.info("[NexoraAC] Floodgate not found — using name prefix \"" + bedrockPrefix
                        + "\" + permission fallback for Bedrock detection.");
            } else {
                LOG.info("[NexoraAC] Floodgate not found and bedrock-prefix is empty — Bedrock bypass disabled.");
            }
        }
    }

    /**
     * Returns {@code true} if the player is a Bedrock (GeyserMC) client.
     * Result is cached per session for performance.
     */
    public static boolean isBedrock(@NotNull Player player) {
        return bedrockCache.contains(player.getUniqueId());
    }

    /**
     * Called on PlayerJoinEvent. Resolves and caches the Bedrock status for a player.
     */
    public static void onPlayerJoin(@NotNull Player player) {
        if (resolve(player)) {
            bedrockCache.add(player.getUniqueId());
        }
    }

    /**
     * Called on PlayerQuitEvent. Clears the cache entry.
     */
    public static void onPlayerQuit(@NotNull Player player) {
        bedrockCache.remove(player.getUniqueId());
    }

    // -----------------------------------------------------------------------

    private static boolean resolve(@NotNull Player player) {
        // 1. Floodgate API (via reflection — Floodgate JAR is optional)
        if (floodgatePresent) {
            try {
                Class<?> apiClass   = Class.forName(FLOODGATE_API_CLASS);
                Object   apiInst    = apiClass.getMethod("getInstance").invoke(null);
                if (apiInst != null) {
                    Object result = apiClass.getMethod("isFloodgatePlayer", java.util.UUID.class)
                                            .invoke(apiInst, player.getUniqueId());
                    if (Boolean.TRUE.equals(result)) {
                        return true;
                    }
                }
            } catch (Throwable t) {
                // Reflection failed — fall through to prefix/permission
            }
        }

        // 2. Name prefix
        if (!bedrockPrefix.isEmpty() && player.getName().startsWith(bedrockPrefix)) {
            return true;
        }

        // 3. Permission node (e.g. granted by LuckPerms Floodgate extension)
        return player.hasPermission("nexora.bedrock");
    }

    /** @return whether the Floodgate plugin is installed */
    public static boolean isFloodgatePresent() {
        return floodgatePresent;
    }

    /** @return the configured Bedrock name prefix */
    public static String getBedrockPrefix() {
        return bedrockPrefix;
    }
}
