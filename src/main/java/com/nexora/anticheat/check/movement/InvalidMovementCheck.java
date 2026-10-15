package com.nexora.anticheat.check.movement;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.player.PlayerMoveEvent;
import org.jetbrains.annotations.NotNull;

/**
 * Detects malformed packets, invalid pitch, NaN coordinates, or impossible coordinate jumps.
 */
public class InvalidMovementCheck extends Check {

    public InvalidMovementCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "InvalidMovement", "Invalid Movement / Derp", CheckCategory.MOVEMENT);
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onMove(PlayerMoveEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null) {
            return;
        }

        Location to = event.getTo();

        // Check for NaN or Infinite coordinates
        if (Double.isNaN(to.getX()) || Double.isNaN(to.getY()) || Double.isNaN(to.getZ())
                || Double.isInfinite(to.getX()) || Double.isInfinite(to.getY()) || Double.isInfinite(to.getZ())) {
            event.setCancelled(true);
            flag(player, data, "NaN or Infinite coordinates detected in packet", 5.0);
            return;
        }

        // Vanilla pitch boundaries are [-90.0, 90.0]
        float pitch = to.getPitch();
        if (Math.abs(pitch) > 90.0F) {
            event.setCancelled(true);
            flag(player, data, String.format("Illegal pitch angle: %.2f (Allowed: [-90, 90])", pitch), 2.0);
            return;
        }

        // Extreme instant displacement (greater than 100 blocks in a single tick without teleport)
        Location from = event.getFrom();
        double distSq = from.distanceSquared(to);
        if (distSq > 10000.0) {
            long now = System.currentTimeMillis();
            if (now - data.getLastTeleportTimestamp() > 1000L) {
                event.setCancelled(true);
                flag(player, data, String.format("Impossible coordinate jump: %.1f blocks without teleport", Math.sqrt(distSq)), 3.0);
            }
        }
    }
}
