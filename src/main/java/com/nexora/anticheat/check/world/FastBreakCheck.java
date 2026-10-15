package com.nexora.anticheat.check.world;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.BlockUtil;
import org.bukkit.block.Block;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockDamageEvent;
import org.jetbrains.annotations.NotNull;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Detects FastBreak / InstantBreak cheats where players mine blocks faster than vanilla survival limits.
 */
public class FastBreakCheck extends Check {

    private double breakTolerance = 0.85;
    private final Map<String, Long> startDamageTimings = new ConcurrentHashMap<>();

    public FastBreakCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "FastBreak", "FastBreak (Mining Speed)", CheckCategory.WORLD);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.breakTolerance = config.getDouble(path + ".break-tolerance", 0.85);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBlockDamage(BlockDamageEvent event) {
        Player player = event.getPlayer();
        String key = player.getUniqueId() + ":" + event.getBlock().getLocation().toVector().toString();
        startDamageTimings.put(key, System.currentTimeMillis());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBlockBreak(BlockBreakEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        Block block = event.getBlock();
        if (BlockUtil.isInstaBreak(block.getType())) {
            return;
        }

        String key = player.getUniqueId() + ":" + block.getLocation().toVector().toString();
        Long startTime = startDamageTimings.remove(key);

        long estimatedMinMs = (long) (BlockUtil.getEstimatedBreakDurationMs(player, block) * breakTolerance);
        if (startTime == null) {
            // Broken without any prior damage packet received
            if (estimatedMinMs > 150L) {
                flag(player, data, String.format("Instant broken block %s with no damage duration (expected: %dms)",
                        block.getType(), estimatedMinMs), 1.0);
            }
            return;
        }

        long actualDuration = System.currentTimeMillis() - startTime;
        if (actualDuration < estimatedMinMs) {
            flag(player, data, String.format("FastBreak: %dms < EstimatedMin: %dms on %s",
                    actualDuration, estimatedMinMs, block.getType()), 1.0);
        }
    }
}
