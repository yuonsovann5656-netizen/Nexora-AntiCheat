package com.nexora.anticheat.check.world;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.BlockPlaceEvent;
import org.jetbrains.annotations.NotNull;

/**
 * Detects FastPlace hacks where players place blocks faster than the client 4-tick placement cooldown.
 */
public class FastPlaceCheck extends Check {

    private long minDelayMs = 80L;

    public FastPlaceCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "FastPlace", "FastPlace (Placement Cooldown)", CheckCategory.WORLD);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.minDelayMs = config.getLong(path + ".min-delay-ms", 80L);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBlockPlace(BlockPlaceEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        long now = System.currentTimeMillis();
        long lastPlace = data.getLastBlockPlaceTimestamp();
        data.registerBlockPlace();

        if (lastPlace == 0L) {
            return;
        }

        long delay = now - lastPlace;
        if (delay < minDelayMs) {
            flag(player, data, String.format("FastPlace: %dms delay < %dms minimum", delay, minDelayMs), 1.0);
        }
    }
}
