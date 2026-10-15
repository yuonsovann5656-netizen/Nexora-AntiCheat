package com.nexora.anticheat.check.movement;

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
 * Detects clients spoofing onGround packet state to avoid fall damage.
 */
public class NoFallCheck extends Check {

    private double minAirDistance = 0.65;

    public NoFallCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "NoFall", "NoFall (Spoofed Ground)", CheckCategory.MOVEMENT);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.minAirDistance = config.getDouble(path + ".min-air-distance", 0.65);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        if (player.isGliding() || player.isFlying() || player.isInsideVehicle()) {
            return;
        }

        Location to = event.getTo();

        // Check if player packet claims onGround == true
        if (player.isOnGround()) {
            // Verify if block below is actually ground or liquid
            if (!LocationUtil.isNearGround(to) && !LocationUtil.isInOrNearLiquid(to) && !LocationUtil.isClimbable(to)) {
                double groundDist = to.getY() - Math.floor(to.getY());
                if (groundDist > minAirDistance) {
                    flag(player, data, String.format("Client claimed onGround but distance to ground is %.3f", groundDist), 1.0);
                }
            }
        }
    }
}
