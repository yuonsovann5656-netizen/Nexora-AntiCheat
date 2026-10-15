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
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.jetbrains.annotations.NotNull;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Detects vertical fly hacks, air hovering, and illegal gravity suspension.
 */
public class FlyCheck extends Check {

    private int maxHoverTicks = 4;
    private final Map<UUID, Integer> airTicksMap = new ConcurrentHashMap<>();
    private final Map<UUID, Integer> hoverTicksMap = new ConcurrentHashMap<>();

    public FlyCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Fly", "Fly / Hovering", CheckCategory.MOVEMENT);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.maxHoverTicks = config.getInt(path + ".max-hover-ticks", 4);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        if (player.isGliding() || player.isFlying() || player.isInsideVehicle() || player.isRiptiding()) {
            airTicksMap.remove(player.getUniqueId());
            hoverTicksMap.remove(player.getUniqueId());
            return;
        }

        Location from = event.getFrom();
        Location to = event.getTo();

        // If player is in liquid, climbable, slime, or near ground -> reset counters
        if (player.isOnGround() || LocationUtil.isNearGround(to) || LocationUtil.isInOrNearLiquid(to)
                || LocationUtil.isClimbable(to) || LocationUtil.isNearSlimeOrHoney(to)) {
            airTicksMap.remove(player.getUniqueId());
            hoverTicksMap.remove(player.getUniqueId());
            return;
        }

        double deltaY = to.getY() - from.getY();
        int airTicks = airTicksMap.compute(player.getUniqueId(), (k, v) -> v == null ? 1 : v + 1);

        // Detect air hovering (constant Y coordinate in air)
        if (Math.abs(deltaY) < 0.005) {
            int hoverTicks = hoverTicksMap.compute(player.getUniqueId(), (k, v) -> v == null ? 1 : v + 1);
            if (hoverTicks > maxHoverTicks) {
                flag(player, data, String.format("Hovering in air for %d ticks (deltaY: %.4f)", hoverTicks, deltaY), 1.0);
            }
        } else {
            hoverTicksMap.remove(player.getUniqueId());
        }

        // Detect ascending in air without jump velocity
        if (deltaY > 0.0 && airTicks > 10) {
            double maxJumpHeight = 0.42;
            PotionEffect jump = player.getPotionEffect(PotionEffectType.JUMP_BOOST);
            if (jump != null) {
                maxJumpHeight += (jump.getAmplifier() + 1) * 0.1;
            }

            if (deltaY > maxJumpHeight && !data.isVelocityPending()) {
                flag(player, data, String.format("Illegal air ascension: deltaY=%.3f, airTicks=%d", deltaY, airTicks), 1.0);
            }
        }
    }
}
