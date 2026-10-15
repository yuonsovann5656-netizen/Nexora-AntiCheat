package com.nexora.anticheat.check.combat;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.LocationUtil;
import org.bukkit.Location;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.player.PlayerMoveEvent;
import org.jetbrains.annotations.NotNull;

/**
 * Detects Anti-Knockback (Velocity modification / 0% knockback).
 */
public class VelocityCheck extends Check {

    private double verticalThreshold = 0.85;

    public VelocityCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Velocity", "Velocity (Anti-Knockback)", CheckCategory.COMBAT);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.verticalThreshold = config.getDouble(path + ".vertical-threshold", 0.85);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        if (!data.isVelocityPending()) {
            return;
        }

        Location from = event.getFrom();
        Location to = event.getTo();
        double deltaY = to.getY() - from.getY();
        double expectedY = data.getExpectedVelocityY();

        // If player has blocks directly above head, skip
        if (to.clone().add(0, 2.0, 0).getBlock().getType().isSolid()) {
            data.setVelocityPending(false);
            return;
        }

        if (LocationUtil.isClimbable(to) || LocationUtil.isInOrNearLiquid(to) || LocationUtil.isNearSlimeOrHoney(to)) {
            data.setVelocityPending(false);
            return;
        }

        // If server sent substantial vertical velocity, but client took zero vertical movement
        if (expectedY > 0.25 && deltaY <= 0.005) {
            flag(player, data, String.format("Anti-KB detected: expectedDeltaY=%.2f, actualDeltaY=%.4f", expectedY, deltaY), 1.0);
        }

        data.setVelocityPending(false);
    }
}
