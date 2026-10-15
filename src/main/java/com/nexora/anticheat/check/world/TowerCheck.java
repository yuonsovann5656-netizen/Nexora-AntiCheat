package com.nexora.anticheat.check.world;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.Location;
import org.bukkit.block.Block;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.BlockPlaceEvent;
import org.jetbrains.annotations.NotNull;

/**
 * Detects Tower hacks where players rapidly ascend vertically by spamming blocks beneath themselves.
 */
public class TowerCheck extends Check {

    private double maxTowerSpeed = 0.42;

    public TowerCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Tower", "Tower (Vertical Auto-Bridging)", CheckCategory.WORLD);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.maxTowerSpeed = config.getDouble(path + ".max-tower-speed", 0.42);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBlockPlace(BlockPlaceEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        Block placed = event.getBlockPlaced();
        Location playerLoc = player.getLocation();

        // Check if block was placed directly below feet while moving straight up
        if (Math.abs(placed.getX() + 0.5 - playerLoc.getX()) < 0.6
                && Math.abs(placed.getZ() + 0.5 - playerLoc.getZ()) < 0.6
                && placed.getY() < playerLoc.getY()) {

            long lastPlace = data.getLastBlockPlaceTimestamp();
            long diff = System.currentTimeMillis() - lastPlace;

            // If ascending vertically and placing blocks at unnatural speed (<120ms without velocity)
            if (diff < 120L && player.getVelocity().getY() > maxTowerSpeed && !data.isVelocityPending()) {
                flag(player, data, String.format("Fast Tower placement: deltaY=%.3f, delay=%dms", player.getVelocity().getY(), diff), 1.0);
            }
        }
    }
}
