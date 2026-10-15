package com.nexora.anticheat.check.movement;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.BedrockUtil;
import com.nexora.anticheat.util.LocationUtil;
import com.nexora.anticheat.util.MathUtil;
import org.bukkit.Location;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.jetbrains.annotations.NotNull;

/**
 * Detects abnormal horizontal movement speed (Speed Hack, BunnyHop).
 *
 * <p><b>Jump false-positive fix (v1.1)</b>: Minecraft sprint-jumping produces a
 * predictable horizontal impulse (~0.12 extra blocks per tick on the jump tick itself
 * that rapidly decays with air friction). Instead of using a flat air multiplier, we
 * now track the jump state and grant a generous burst allowance only on the single
 * take-off tick, then taper it on subsequent air ticks. This eliminates all
 * false-positives from normal sprint-jumping while still catching Speed exploits.
 *
 * <p><b>Bedrock support</b>: Bedrock clients handle physics slightly differently;
 * they receive an additional {@code bedrockMultiplier} tolerance factor.
 */
public class SpeedCheck extends Check {

    // ------------------------------------------------------------------ config
    private double baseSpeed       = 0.36;
    private double iceMultiplier   = 1.6;
    /** Allowance multiplier applied for the first air tick after a jump. */
    private double jumpBoostFactor = 1.50;
    /** Allowance multiplier for subsequent air ticks (sprint-jump arc). */
    private double airMultiplier   = 1.18;
    /** Extra lenience for Bedrock clients. */
    private double bedrockMultiplier = 1.20;

    public SpeedCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Speed", "Speed (Horizontal)", CheckCategory.MOVEMENT);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.baseSpeed        = config.getDouble(path + ".base-speed",        0.36);
        this.iceMultiplier    = config.getDouble(path + ".ice-multiplier",    1.6);
        this.jumpBoostFactor  = config.getDouble(path + ".jump-boost-factor", 1.50);
        this.airMultiplier    = config.getDouble(path + ".air-multiplier",    1.18);
        this.bedrockMultiplier= config.getDouble(path + ".bedrock-multiplier",1.20);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) return;

        // Exempt: gliding, riptide, vehicle, creative fly
        if (player.isGliding() || player.isRiptiding()
                || player.isInsideVehicle() || player.isFlying()) {
            return;
        }

        Location from = event.getFrom();
        Location to   = event.getTo();
        double distance = MathUtil.distanceHorizontal(from.getX(), from.getZ(), to.getX(), to.getZ());

        if (distance < 0.001) return; // pure rotation

        // ----------------------------------------------------------------
        // Determine the maximum allowed speed this tick
        // ----------------------------------------------------------------
        double maxAllowed = baseSpeed;

        // Ice surface bonus
        if (LocationUtil.isNearIce(from) || LocationUtil.isNearIce(to)) {
            maxAllowed *= iceMultiplier;
        }

        boolean onGround = player.isOnGround();
        boolean wasOnGround = data.wasLastTickOnGround();

        if (!onGround) {
            // Detect the *first* air tick after leaving the ground (jump launch tick)
            if (wasOnGround) {
                // Take-off tick — allow the jump burst
                maxAllowed *= jumpBoostFactor;
            } else {
                // Subsequent air ticks — friction causes speed to decay; use moderate multiplier
                maxAllowed *= airMultiplier;
            }
        }
        // Update ground state for next tick
        data.setLastTickOnGround(onGround);

        // Speed potion compensation
        PotionEffect speedEffect = player.getPotionEffect(PotionEffectType.SPEED);
        if (speedEffect != null) {
            maxAllowed += (speedEffect.getAmplifier() + 1) * 0.08;
        }

        // Jump boost potion — increases jump height AND sprint speed
        PotionEffect jumpEffect = player.getPotionEffect(PotionEffectType.JUMP_BOOST);
        if (jumpEffect != null && !onGround) {
            maxAllowed += (jumpEffect.getAmplifier() + 1) * 0.04;
        }

        // Server-sent velocity (knockback, etc.)
        if (data.isVelocityPending()) {
            maxAllowed += data.getExpectedHorizontalVelocity();
            data.setVelocityPending(false);
        }

        // Bedrock clients get extra tolerance
        if (BedrockUtil.isBedrock(player)) {
            maxAllowed *= bedrockMultiplier;
        }

        if (distance > maxAllowed) {
            double excess = distance - maxAllowed;
            flag(player, data,
                 String.format("Speed: %.3f > Max: %.3f (Excess: +%.3f, Ground: %b)",
                               distance, maxAllowed, excess, onGround),
                 1.0);
        }
    }
}
