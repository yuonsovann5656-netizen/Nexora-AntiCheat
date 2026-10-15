package com.nexora.anticheat.check.movement;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.Location;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.player.PlayerMoveEvent;
import org.jetbrains.annotations.NotNull;

/**
 * Detects illegal step height modifications (e.g. stepping up full blocks instantaneously).
 */
public class StepCheck extends Check {

    private double maxStepHeight = 0.62;

    public StepCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Step", "Step (Illegal Step Height)", CheckCategory.MOVEMENT);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.maxStepHeight = config.getDouble(path + ".max-step-height", 0.62);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        if (player.isGliding() || player.isFlying() || player.isInsideVehicle() || player.isRiptiding()) {
            return;
        }

        Location from = event.getFrom();
        Location to = event.getTo();

        double deltaY = to.getY() - from.getY();

        // Normal vanilla step height is 0.6 (slabs/stairs/path blocks)
        // If client gains > maxStepHeight in a single ground tick without jump velocity or pending server velocity
        if (deltaY > maxStepHeight && player.isOnGround() && !data.isVelocityPending()) {
            flag(player, data, String.format("Illegal step height: deltaY=%.3f > maxStep=%.3f", deltaY, maxStepHeight), 1.0);
        }
    }
}
