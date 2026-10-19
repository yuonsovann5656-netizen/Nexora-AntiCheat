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
 * <p><b>Sprint-Jump Multi-Tick Arc Physics Fix</b>:
 * In Minecraft, a legitimate sprint-jump produces a forward momentum impulse that
 * lasts across 5 to 6 airborne ticks before drag slows the player down. Rather than
 * a single-tick boost, this check models the true parabolic momentum decay table:
 * <ul>
 *   <li>Tick 0 (launch): 1.55x base speed</li>
 *   <li>Tick 1: 1.42x</li>
 *   <li>Tick 2: 1.30x</li>
 *   <li>Tick 3: 1.20x</li>
 *   <li>Tick 4: 1.12x</li>
 *   <li>Tick 5: 1.07x</li>
 *   <li>Tick 6+ (continuous airborne): 1.05x (tighter detection for Fly hacks)</li>
 * </ul>
 *
 * <p>Also incorporates instant flag threshold scaling and feeds real-time movement
 * samples into the server's local {@code AiDetectionEngine} on CPU/RAM.
 */
public class SpeedCheck extends Check {

    private double baseSpeed         = 0.36;
    private double iceMultiplier     = 1.6;
    private double jumpBoostFactor   = 1.55;
    private double jumpDecay1        = 1.42;
    private double jumpDecay2        = 1.30;
    private double jumpDecay3        = 1.20;
    private double jumpDecay4        = 1.12;
    private double jumpDecay5        = 1.07;
    private double airMultiplier     = 1.05;
    private double bedrockMultiplier = 1.25;

    public SpeedCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Speed", "Speed (Horizontal)", CheckCategory.MOVEMENT);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.baseSpeed         = config.getDouble(path + ".base-speed",         0.36);
        this.iceMultiplier     = config.getDouble(path + ".ice-multiplier",     1.6);
        this.jumpBoostFactor   = config.getDouble(path + ".jump-boost-factor",  1.55);
        this.jumpDecay1        = config.getDouble(path + ".jump-decay-1",       1.42);
        this.jumpDecay2        = config.getDouble(path + ".jump-decay-2",       1.30);
        this.jumpDecay3        = config.getDouble(path + ".jump-decay-3",       1.20);
        this.jumpDecay4        = config.getDouble(path + ".jump-decay-4",       1.12);
        this.jumpDecay5        = config.getDouble(path + ".jump-decay-5",       1.07);
        this.airMultiplier     = config.getDouble(path + ".air-multiplier",     1.05);
        this.bedrockMultiplier = config.getDouble(path + ".bedrock-multiplier", 1.25);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) return;

        // Exempt: gliding, riptide, vehicle, creative fly
        if (player.isGliding() || player.isRiptiding()
                || player.isInsideVehicle() || player.isFlying()) {
            data.setAirTickCount(0);
            return;
        }

        Location from = event.getFrom();
        Location to   = event.getTo();
        double distance = MathUtil.distanceHorizontal(from.getX(), from.getZ(), to.getX(), to.getZ());

        if (distance < 0.001) return; // rotation only

        double maxAllowed = baseSpeed;

        // Surface friction
        if (LocationUtil.isNearIce(from) || LocationUtil.isNearIce(to)) {
            maxAllowed *= iceMultiplier;
        }

        boolean onGround = player.isOnGround();

        if (onGround) {
            data.setAirTickCount(0);
        } else {
            int airTicks = data.getAirTickCount();
            // Multi-tick jump momentum decay table
            switch (airTicks) {
                case 0 -> maxAllowed *= jumpBoostFactor;
                case 1 -> maxAllowed *= jumpDecay1;
                case 2 -> maxAllowed *= jumpDecay2;
                case 3 -> maxAllowed *= jumpDecay3;
                case 4 -> maxAllowed *= jumpDecay4;
                case 5 -> maxAllowed *= jumpDecay5;
                default -> maxAllowed *= airMultiplier;
            }
            data.setAirTickCount(airTicks + 1);
        }

        data.setLastTickOnGround(onGround);

        // Speed potion compensation
        PotionEffect speedEffect = player.getPotionEffect(PotionEffectType.SPEED);
        if (speedEffect != null) {
            maxAllowed += (speedEffect.getAmplifier() + 1) * 0.08;
        }

        // Jump boost potion compensation
        PotionEffect jumpEffect = player.getPotionEffect(PotionEffectType.JUMP_BOOST);
        if (jumpEffect != null && !onGround) {
            maxAllowed += (jumpEffect.getAmplifier() + 1) * 0.05;
        }

        // Server-sent velocity compensation (knockback, explosions)
        if (data.isVelocityPending()) {
            maxAllowed += data.getExpectedHorizontalVelocity();
            data.setVelocityPending(false);
        }

        // Bedrock clients tolerance
        if (BedrockUtil.isBedrock(player)) {
            maxAllowed *= bedrockMultiplier;
        }

        // Feed telemetry sample to the local AI Engine running on CPU/RAM
        if (plugin.getAiDetectionEngine() != null) {
            plugin.getAiDetectionEngine().sample(
                    player.getUniqueId(),
                    data.getCps(),
                    distance,
                    Math.abs(to.getYaw() - from.getYaw()),
                    data.getTotalViolationLevel()
            );
        }

        // Fast detection: if horizontal distance exceeds allowed threshold, flag immediately
        if (distance > maxAllowed) {
            double excess = distance - maxAllowed;
            // Scale added VL proportionally to how high the speed cheat was (Faster Detection)
            double addedVl = Math.max(1.0, excess * 4.0);
            flag(player, data,
                 String.format("Speed: %.3f > Max: %.3f (Excess: +%.3f, AirTicks: %d, Ground: %b)",
                               distance, maxAllowed, excess, data.getAirTickCount(), onGround),
                 addedVl);
        }
    }
}
