package com.nexora.anticheat.data;

import org.bukkit.Location;
import org.jetbrains.annotations.NotNull;

/**
 * Immutable snapshot of a player's spatial transform and environmental state at a given instant.
 */
public record LocationRecord(
        double x,
        double y,
        double z,
        float yaw,
        float pitch,
        boolean onGround,
        long timestamp
) {
    public static LocationRecord fromLocation(@NotNull Location location, boolean onGround) {
        return new LocationRecord(
                location.getX(),
                location.getY(),
                location.getZ(),
                location.getYaw(),
                location.getPitch(),
                onGround,
                System.currentTimeMillis()
        );
    }
}
