package com.nexora.anticheat.util;

import org.bukkit.Bukkit;
import org.bukkit.entity.Entity;
import org.bukkit.plugin.Plugin;

import java.util.concurrent.TimeUnit;

/**
 * Universal scheduling utility supporting modern Paper and Folia regionized threading models.
 */
public final class TaskUtil {

    private static boolean isFolia = false;

    static {
        try {
            Class.forName("io.papermc.paper.threadedregions.RegionizedServer");
            isFolia = true;
        } catch (ClassNotFoundException ignored) {
            isFolia = false;
        }
    }

    private TaskUtil() {
        // Utility class
    }

    /**
     * Checks if the server environment is Folia.
     *
     * @return True if running on a Folia-based server.
     */
    public static boolean isFolia() {
        return isFolia;
    }

    /**
     * Runs a task asynchronously without blocking any tick loops.
     *
     * @param plugin   Plugin instance.
     * @param runnable Code to execute.
     */
    public static void runAsync(Plugin plugin, Runnable runnable) {
        if (isFolia) {
            Bukkit.getAsyncScheduler().runNow(plugin, task -> runnable.run());
        } else {
            Bukkit.getScheduler().runTaskAsynchronously(plugin, runnable);
        }
    }

    /**
     * Runs a delayed task asynchronously.
     *
     * @param plugin   Plugin instance.
     * @param runnable Code to execute.
     * @param delayMs  Delay in milliseconds.
     */
    public static void runAsyncLater(Plugin plugin, Runnable runnable, long delayMs) {
        if (isFolia) {
            Bukkit.getAsyncScheduler().runDelayed(plugin, task -> runnable.run(), delayMs, TimeUnit.MILLISECONDS);
        } else {
            long ticks = Math.max(1, delayMs / 50);
            Bukkit.getScheduler().runTaskLaterAsynchronously(plugin, runnable, ticks);
        }
    }

    /**
     * Runs a repeating task asynchronously.
     *
     * @param plugin      Plugin instance.
     * @param runnable    Code to execute.
     * @param initialMs   Initial delay in milliseconds.
     * @param intervalMs  Interval in milliseconds.
     */
    public static void runAsyncTimer(Plugin plugin, Runnable runnable, long initialMs, long intervalMs) {
        if (isFolia) {
            Bukkit.getAsyncScheduler().runAtFixedRate(plugin, task -> runnable.run(), initialMs, intervalMs, TimeUnit.MILLISECONDS);
        } else {
            long initialTicks = Math.max(1, initialMs / 50);
            long intervalTicks = Math.max(1, intervalMs / 50);
            Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, runnable, initialTicks, intervalTicks);
        }
    }

    /**
     * Executes code safely on the entity's thread (region thread in Folia or main thread in Paper).
     *
     * @param plugin   Plugin instance.
     * @param entity   Target entity.
     * @param runnable Code to execute on entity thread.
     */
    public static void runEntity(Plugin plugin, Entity entity, Runnable runnable) {
        if (isFolia) {
            entity.getScheduler().run(plugin, task -> runnable.run(), null);
        } else {
            if (Bukkit.isPrimaryThread()) {
                runnable.run();
            } else {
                Bukkit.getScheduler().runTask(plugin, runnable);
            }
        }
    }

    /**
     * Executes delayed code safely on the entity's thread (region thread in Folia or main thread in Paper).
     *
     * @param plugin   Plugin instance.
     * @param entity   Target entity.
     * @param runnable Code to execute.
     * @param ticks    Delay in server ticks.
     */
    public static void runEntityLater(Plugin plugin, Entity entity, Runnable runnable, long ticks) {
        if (isFolia) {
            entity.getScheduler().runDelayed(plugin, task -> runnable.run(), null, ticks);
        } else {
            Bukkit.getScheduler().runTaskLater(plugin, runnable, ticks);
        }
    }
}
