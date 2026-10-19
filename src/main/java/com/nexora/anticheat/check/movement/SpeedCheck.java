package com.nexora.anticheat.check.movement;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.BedrockUtil;
import com.nexora.anticheat.util.LocationUtil;
import com.nexora.anticheat.util.MathUtil;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.jetbrains.annotations.NotNull;

/**
 * Detects abnormal horizontal movement speed (Speed Hack, Timer, BunnyHop).
 *
 * <p><b>Authentic Vanilla Physics & Multi-Tick Sprint-Jump Arc</b>:
 * In Minecraft vanilla physics:
 * <ul>
 *   <li>Ground sprint: 0.286 blocks/tick (with strafe/corner inertia up to 0.38)</li>
 *   <li>Sprint-jump launch (tick 0): Adds 0.20 forward impulse vector, reaching 0.612 to 0.650 blocks/tick</li>
 *   <li>Airborne decay: Motion degrades with 0.91 drag and 0.026 air acceleration across 6 ticks</li>
 *   <li>Landing momentum: Touching ground retains forward momentum for 2-3 ticks (bunnyhop transition)</li>
 *   <li>Micro-elevations: Stairs, slabs, and snow layers cause momentary horizontal step deltas</li>
 * </ul>
 *
 * <p>Integrates an adaptive jitter buffer to absorb single-packet network bunching
 * while catching continuous or blatant speed hacks instantly, and feeds telemetry into
 * the local server AI Engine running on CPU/RAM.
 */
public class SpeedCheck extends Check {

    private double baseSpeed         = 0.36;
    private double sprintMultiplier  = 1.18;
    private double iceMultiplier     = 1.60;
    private double jumpBoostFactor   = 1.95;
    private double jumpDecay1        = 1.78;
    private double jumpDecay2        = 1.62;
    private double jumpDecay3        = 1.45;
    private double jumpDecay4        = 1.30;
    private double jumpDecay5        = 1.18;
    private double airMultiplier     = 1.08;
    private double bedrockMultiplier = 1.25;

    public SpeedCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Speed", "Speed (Horizontal)", CheckCategory.MOVEMENT);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.baseSpeed         = config.getDouble(path + ".base-speed",         0.36);
        this.sprintMultiplier  = config.getDouble(path + ".sprint-multiplier",  1.18);
        this.iceMultiplier     = config.getDouble(path + ".ice-multiplier",     1.60);
        this.jumpBoostFactor   = config.getDouble(path + ".jump-boost-factor",  1.95);
        this.jumpDecay1        = config.getDouble(path + ".jump-decay-1",       1.78);
        this.jumpDecay2        = config.getDouble(path + ".jump-decay-2",       1.62);
        this.jumpDecay3        = config.getDouble(path + ".jump-decay-3",       1.45);
        this.jumpDecay4        = config.getDouble(path + ".jump-decay-4",       1.30);
        this.jumpDecay5        = config.getDouble(path + ".jump-decay-5",       1.18);
        this.airMultiplier     = config.getDouble(path + ".air-multiplier",     1.08);
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
            data.setGroundTicks(10);
            data.setSpeedBuffer(0.0);
            return;
        }

        Location from = event.getFrom();
        Location to   = event.getTo();
        double distance = MathUtil.distanceHorizontal(from.getX(), from.getZ(), to.getX(), to.getZ());

        if (distance < 0.001) return; // rotation only

        boolean onGround = player.isOnGround();
        boolean wasOnGround = data.wasLastTickOnGround();
        boolean isSprinting = player.isSprinting();
        double deltaY = to.getY() - from.getY();

        // Update ground & air tick tracking
        if (onGround) {
            data.setAirTickCount(0);
            data.setGroundTicks(data.getGroundTicks() + 1);
        } else {
            data.setGroundTicks(0);
            data.setAirTickCount(data.getAirTickCount() + 1);
        }

        // Base ground allowance
        double maxAllowed = baseSpeed;

        if (isSprinting) {
            maxAllowed *= sprintMultiplier; // 0.36 * 1.18 = 0.425
        }

        // Jump & airborne momentum model
        if (!onGround) {
            int airTicks = data.getAirTickCount();
            if (isSprinting || data.getSprintJumpTicks() > 0 || (wasOnGround && deltaY > 0.0)) {
                // Sprint jump momentum decay table
                switch (airTicks) {
                    case 0, 1 -> maxAllowed = Math.max(maxAllowed, baseSpeed * jumpBoostFactor); // ~0.702 (covers 0.612 launch + strafe + jitter)
                    case 2    -> maxAllowed = Math.max(maxAllowed, baseSpeed * jumpDecay1);     // ~0.640
                    case 3    -> maxAllowed = Math.max(maxAllowed, baseSpeed * jumpDecay2);     // ~0.583
                    case 4    -> maxAllowed = Math.max(maxAllowed, baseSpeed * jumpDecay3);     // ~0.522
                    case 5    -> maxAllowed = Math.max(maxAllowed, baseSpeed * jumpDecay4);     // ~0.468
                    case 6    -> maxAllowed = Math.max(maxAllowed, baseSpeed * jumpDecay5);     // ~0.425
                    default   -> maxAllowed = Math.max(maxAllowed, baseSpeed * airMultiplier);   // ~0.388
                }
                data.setSprintJumpTicks(data.getSprintJumpTicks() + 1);
            } else {
                // Normal walking jump (non-sprint)
                switch (airTicks) {
                    case 0, 1 -> maxAllowed = Math.max(maxAllowed, baseSpeed * 1.35); // ~0.486
                    case 2, 3 -> maxAllowed = Math.max(maxAllowed, baseSpeed * 1.25); // ~0.450
                    case 4, 5 -> maxAllowed = Math.max(maxAllowed, baseSpeed * 1.15); // ~0.414
                    default   -> maxAllowed = Math.max(maxAllowed, baseSpeed * 1.05); // ~0.378
                }
            }
        } else {
            // Player is on ground: check landing momentum (bunnyhop / landing transition)
            int groundTicks = data.getGroundTicks();
            if (groundTicks <= 3) {
                // Player just landed within last 3 ticks: preserve decaying landing momentum
                if (groundTicks <= 1) {
                    maxAllowed = Math.max(maxAllowed, baseSpeed * 1.45); // ~0.522 landing tick
                } else if (groundTicks == 2) {
                    maxAllowed = Math.max(maxAllowed, baseSpeed * 1.30); // ~0.468
                } else {
                    maxAllowed = Math.max(maxAllowed, baseSpeed * 1.18); // ~0.425
                }
            } else {
                data.setSprintJumpTicks(0);
            }
        }

        data.setLastTickOnGround(onGround);

        // Stairs, slabs, and partial step elevation tolerance
        if (LocationUtil.isNearStairsOrSlabs(from) || LocationUtil.isNearStairsOrSlabs(to)) {
            maxAllowed += 0.08;
        }

        // Ice and slippery blocks
        if (LocationUtil.isNearIce(from) || LocationUtil.isNearIce(to)) {
            maxAllowed *= iceMultiplier;
        }

        // Slime and honey blocks
        if (LocationUtil.isNearSlimeOrHoney(from) || LocationUtil.isNearSlimeOrHoney(to)) {
            maxAllowed *= 1.35;
        }

        // Soul sand / Soul soil with Soul Speed
        try {
            Material underMat = from.getBlock().getRelative(0, -1, 0).getType();
            if (underMat == Material.SOUL_SAND || underMat == Material.SOUL_SOIL) {
                maxAllowed += 0.20;
            }
        } catch (Exception ignored) {}

        // Speed potion effect compensation
        PotionEffect speedEffect = player.getPotionEffect(PotionEffectType.SPEED);
        if (speedEffect != null) {
            double boost = (speedEffect.getAmplifier() + 1) * 0.09;
            if (isSprinting) boost *= 1.25;
            maxAllowed += boost;
        }

        // Jump boost potion effect compensation
        PotionEffect jumpEffect = player.getPotionEffect(PotionEffectType.JUMP_BOOST);
        if (jumpEffect != null && !onGround) {
            maxAllowed += (jumpEffect.getAmplifier() + 1) * 0.06;
        }

        // Server-sent velocity compensation (knockback, explosions, player damage)
        if (data.isVelocityPending()) {
            maxAllowed += data.getExpectedHorizontalVelocity();
            data.setVelocityPending(false);
        }

        // Bedrock clients tolerance
        if (BedrockUtil.isBedrock(player)) {
            maxAllowed *= bedrockMultiplier;
        }

        // Feed real-time telemetry sample into the local AI Detection Engine on CPU/RAM
        if (plugin.getAiDetectionEngine() != null) {
            plugin.getAiDetectionEngine().sample(
                    player.getUniqueId(),
                    data.getCps(),
                    distance,
                    Math.abs(to.getYaw() - from.getYaw()),
                    data.getTotalViolationLevel()
            );
        }

        // Fast Detection & Anti-Jitter Buffer Evaluation
        if (distance > maxAllowed) {
            double excess = distance - maxAllowed;

            // Blatant speed hacks (> 0.18 blocks/tick over max, e.g. 2x speed or high-velocity fly)
            if (excess > 0.18) {
                double addedVl = Math.max(2.0, excess * 6.0);
                flag(player, data,
                     String.format("Speed: %.3f > Max: %.3f (Blatant: +%.3f, Air: %d, Ground: %b)",
                                   distance, maxAllowed, excess, data.getAirTickCount(), onGround),
                     addedVl);
            } else {
                // Subtle or medium speed cheats: accumulate jitter buffer
                double newBuffer = data.getSpeedBuffer() + excess;
                data.setSpeedBuffer(newBuffer);

                // Threshold buffer of 0.10 catches continuous speed cheats within 2-3 ticks while absorbing 1-tick ping spikes
                if (newBuffer > 0.10) {
                    double addedVl = Math.max(1.0, newBuffer * 4.0);
                    flag(player, data,
                         String.format("Speed: %.3f > Max: %.3f (Buffer: %.3f, Excess: +%.3f, Air: %d, Ground: %b)",
                                       distance, maxAllowed, newBuffer, excess, data.getAirTickCount(), onGround),
                         addedVl);
                    // Maintain partial buffer so repeated cheat ticks trigger continuous fast alerts
                    data.setSpeedBuffer(0.05);
                }
            }
        } else {
            // Normal legitimate movement: decay jitter buffer smoothly
            double currentBuffer = data.getSpeedBuffer();
            if (currentBuffer > 0.0) {
                data.setSpeedBuffer(currentBuffer - 0.02);
            }
        }
    }
}
