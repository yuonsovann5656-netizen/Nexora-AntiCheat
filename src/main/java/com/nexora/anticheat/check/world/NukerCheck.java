package com.nexora.anticheat.check.world;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.BlockUtil;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.BlockBreakEvent;
import org.jetbrains.annotations.NotNull;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Detects Nuker cheats breaking multiple blocks in a single tick or at extreme frequencies.
 */
public class NukerCheck extends Check {

    private int maxBlocksPerTick = 2;
    private final Map<UUID, Long> lastBreakTime = new ConcurrentHashMap<>();
    private final Map<UUID, Integer> breakCountInWindow = new ConcurrentHashMap<>();

    public NukerCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Nuker", "Nuker (Mass Block Breaking)", CheckCategory.WORLD);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.maxBlocksPerTick = config.getInt(path + ".max-blocks-per-tick", 2);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBlockBreak(BlockBreakEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        if (BlockUtil.isInstaBreak(event.getBlock().getType())) {
            return;
        }

        UUID uuid = player.getUniqueId();
        long now = System.currentTimeMillis();
        long lastTime = lastBreakTime.getOrDefault(uuid, 0L);

        if (now - lastTime < 50L) {
            int count = breakCountInWindow.compute(uuid, (k, v) -> v == null ? 1 : v + 1);
            if (count > maxBlocksPerTick) {
                flag(player, data, String.format("Nuker: Broke %d non-insta blocks in <50ms", count), 1.0);
            }
        } else {
            breakCountInWindow.put(uuid, 1);
            lastBreakTime.put(uuid, now);
        }
    }
}
