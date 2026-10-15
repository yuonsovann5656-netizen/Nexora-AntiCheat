package com.nexora.anticheat.check.world;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.RayTraceUtil;
import org.bukkit.Location;
import org.bukkit.block.Block;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.BlockPlaceEvent;
import org.jetbrains.annotations.NotNull;

/**
 * Detects Scaffold / AutoBridge hacks where players place blocks without looking or while sprinting backwards.
 */
public class ScaffoldCheck extends Check {

    private double maxAngle = 75.0;

    public ScaffoldCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Scaffold", "Scaffold (Bridging / Placement Angle)", CheckCategory.WORLD);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.maxAngle = config.getDouble(path + ".max-angle", 75.0);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBlockPlace(BlockPlaceEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        Block placed = event.getBlockPlaced();
        Location eyeLoc = player.getEyeLocation();
        Location blockCenter = placed.getLocation().add(0.5, 0.5, 0.5);

        double angle = RayTraceUtil.getAngleOffset(eyeLoc, blockCenter);

        // Placing blocks behind back or outside line of sight
        if (angle > maxAngle) {
            flag(player, data, String.format("Placing block outside field of view: angle=%.1f° > %.1f°", angle, maxAngle), 1.0);
            return;
        }

        // Downward bridging while sprinting without sneaking
        if (placed.getY() < player.getLocation().getY() && player.isSprinting() && !player.isSneaking()) {
            if (angle > 65.0) {
                flag(player, data, String.format("Fast downward sprint bridging: angle=%.1f°", angle), 1.0);
            }
        }
    }
}
