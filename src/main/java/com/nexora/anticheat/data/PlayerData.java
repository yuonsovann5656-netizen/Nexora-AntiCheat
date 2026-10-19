package com.nexora.anticheat.data;

import com.nexora.anticheat.util.MathUtil;
import org.bukkit.Location;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * Thread-safe container encapsulating all anti-cheat telemetry and temporal state for a player.
 */
public class PlayerData {

    private final UUID uniqueId;
    private String username;
    private String clientBrand = "vanilla";

    // Movement History
    private final Deque<LocationRecord> movementHistory = new ConcurrentLinkedDeque<>();
    private static final int MAX_HISTORY_SIZE = 40;
    private Location lastSafeGroundLocation;

    // Click Analysis
    private final Deque<Long> leftClickTimings = new ConcurrentLinkedDeque<>();
    private static final int MAX_CLICK_SAMPLES = 50;

    // Server-sent Velocity Tracking
    private double expectedVelocityX;
    private double expectedVelocityY;
    private double expectedVelocityZ;
    private long lastVelocityTimestamp;
    private boolean velocityPending;

    // Immunity & Lag State Timestamps
    private long lastTeleportTimestamp;
    private long lastRespawnTimestamp;
    private final long joinTimestamp;
    private long exemptionExpiry = 0L;

    // Combat & Action Timestamps
    private long lastAttackTimestamp;
    private UUID lastTargetId;
    private long lastBlockPlaceTimestamp;
    private long lastBlockBreakTimestamp;
    private long itemUseStartTimestamp;

    // Violations Map: Check ID -> Violation Level
    private final Map<String, Double> violationLevels = new ConcurrentHashMap<>();

    // Movement per-tick state (used by SpeedCheck to distinguish jump-launch tick)
    private volatile boolean lastTickOnGround = true;
    private volatile int airTickCount = 0;

    // Alert toggles (Staff)
    private boolean alertsEnabled = true;

    public PlayerData(@NotNull UUID uniqueId, @NotNull String username) {
        this.uniqueId = uniqueId;
        this.username = username;
        this.joinTimestamp = System.currentTimeMillis();
    }

    public UUID getUniqueId() {
        return uniqueId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getClientBrand() {
        return clientBrand;
    }

    public void setClientBrand(String clientBrand) {
        this.clientBrand = clientBrand;
    }

    // --- Movement History ---

    public void addLocationRecord(@NotNull Location location, boolean onGround) {
        movementHistory.addFirst(LocationRecord.fromLocation(location, onGround));
        while (movementHistory.size() > MAX_HISTORY_SIZE) {
            movementHistory.removeLast();
        }

        if (onGround && location.getBlock().getType().isSolid()) {
            this.lastSafeGroundLocation = location.clone();
        }
    }

    @Nullable
    public LocationRecord getPreviousLocation(int index) {
        if (index < 0 || index >= movementHistory.size()) {
            return null;
        }
        Iterator<LocationRecord> it = movementHistory.iterator();
        LocationRecord current = null;
        for (int i = 0; i <= index && it.hasNext(); i++) {
            current = it.next();
        }
        return current;
    }

    @Nullable
    public Location getLastSafeGroundLocation() {
        return lastSafeGroundLocation;
    }

    public void setLastSafeGroundLocation(@Nullable Location loc) {
        this.lastSafeGroundLocation = loc != null ? loc.clone() : null;
    }

    // --- Clicks & AutoClicker Analysis ---

    public void registerLeftClick() {
        long now = System.currentTimeMillis();
        leftClickTimings.addFirst(now);
        while (leftClickTimings.size() > MAX_CLICK_SAMPLES) {
            leftClickTimings.removeLast();
        }
    }

    /**
     * Calculates the Clicks Per Second (CPS) within the last 1000 milliseconds.
     */
    public double getCps() {
        long now = System.currentTimeMillis();
        long threshold = now - 1000L;
        int count = 0;
        for (Long timestamp : leftClickTimings) {
            if (timestamp >= threshold) {
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    /**
     * Computes the statistical variance of the click interval delays in milliseconds.
     */
    public double getClickIntervalVariance() {
        List<Long> intervals = new ArrayList<>();
        Long prev = null;
        for (Long timestamp : leftClickTimings) {
            if (prev != null) {
                intervals.add(Math.abs(prev - timestamp));
            }
            prev = timestamp;
            if (intervals.size() >= 20) break;
        }
        return MathUtil.getVariance(intervals);
    }

    // --- Server-Sent Velocity ---

    public void registerServerVelocity(double vx, double vy, double vz) {
        this.expectedVelocityX = vx;
        this.expectedVelocityY = vy;
        this.expectedVelocityZ = vz;
        this.lastVelocityTimestamp = System.currentTimeMillis();
        this.velocityPending = true;
    }

    public boolean isVelocityPending() {
        return velocityPending;
    }

    public void setVelocityPending(boolean pending) {
        this.velocityPending = pending;
    }

    public long getLastVelocityTimestamp() {
        return lastVelocityTimestamp;
    }

    public double getExpectedVelocityY() {
        return expectedVelocityY;
    }

    public double getExpectedHorizontalVelocity() {
        return Math.sqrt(expectedVelocityX * expectedVelocityX + expectedVelocityZ * expectedVelocityZ);
    }

    // --- Action Timestamps ---

    public void registerTeleport() {
        this.lastTeleportTimestamp = System.currentTimeMillis();
    }

    public long getLastTeleportTimestamp() {
        return lastTeleportTimestamp;
    }

    public void registerRespawn() {
        this.lastRespawnTimestamp = System.currentTimeMillis();
    }

    public long getLastRespawnTimestamp() {
        return lastRespawnTimestamp;
    }

    public long getJoinTimestamp() {
        return joinTimestamp;
    }

    public void registerAttack(UUID targetId) {
        this.lastAttackTimestamp = System.currentTimeMillis();
        this.lastTargetId = targetId;
    }

    public long getLastAttackTimestamp() {
        return lastAttackTimestamp;
    }

    public UUID getLastTargetId() {
        return lastTargetId;
    }

    public void registerBlockPlace() {
        this.lastBlockPlaceTimestamp = System.currentTimeMillis();
    }

    public long getLastBlockPlaceTimestamp() {
        return lastBlockPlaceTimestamp;
    }

    public void registerBlockBreak() {
        this.lastBlockBreakTimestamp = System.currentTimeMillis();
    }

    public long getLastBlockBreakTimestamp() {
        return lastBlockBreakTimestamp;
    }

    public void registerItemUseStart() {
        this.itemUseStartTimestamp = System.currentTimeMillis();
    }

    public long getItemUseStartTimestamp() {
        return itemUseStartTimestamp;
    }

    // --- Exemption ---

    public boolean isExempt() {
        return System.currentTimeMillis() < exemptionExpiry;
    }

    public void setExemption(long durationMs) {
        this.exemptionExpiry = System.currentTimeMillis() + durationMs;
    }

    public void clearExemption() {
        this.exemptionExpiry = 0L;
    }

    public long getExemptionExpiry() {
        return exemptionExpiry;
    }

    // --- Violation Tracking ---

    public double getViolationLevel(String checkId) {
        return violationLevels.getOrDefault(checkId.toLowerCase(), 0.0);
    }

    public double addViolationLevel(String checkId, double amount) {
        return violationLevels.compute(checkId.toLowerCase(), (id, current) -> (current == null ? 0.0 : current) + amount);
    }

    public void decayViolationLevels(double decayAmount) {
        violationLevels.replaceAll((k, v) -> Math.max(0.0, v - decayAmount));
    }

    public void resetViolations() {
        violationLevels.clear();
    }

    public double getTotalViolationLevel() {
        double sum = 0.0;
        for (Double vl : violationLevels.values()) {
            sum += vl;
        }
        return sum;
    }

    public Map<String, Double> getViolations() {
        return Collections.unmodifiableMap(violationLevels);
    }

    // --- Ground State (per-tick, for SpeedCheck jump detection) ---

    public boolean wasLastTickOnGround() {
        return lastTickOnGround;
    }

    public void setLastTickOnGround(boolean onGround) {
        this.lastTickOnGround = onGround;
    }

    public int getAirTickCount() {
        return airTickCount;
    }

    public void setAirTickCount(int count) {
        this.airTickCount = count;
    }

    public boolean areAlertsEnabled() {
        return alertsEnabled;
    }

    public void setAlertsEnabled(boolean alertsEnabled) {
        this.alertsEnabled = alertsEnabled;
    }
}
