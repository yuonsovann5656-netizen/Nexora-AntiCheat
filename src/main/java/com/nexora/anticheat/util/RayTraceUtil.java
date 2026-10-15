package com.nexora.anticheat.util;

import org.bukkit.Location;
import org.bukkit.entity.Entity;
import org.bukkit.util.BoundingBox;
import org.bukkit.util.Vector;

/**
 * Utility for ray tracing and calculating distance from player eye to entity bounding boxes.
 */
public final class RayTraceUtil {

    private RayTraceUtil() {
        // Utility class
    }

    /**
     * Calculates the minimum distance from a ray source (such as player's eyes) to an entity's bounding box.
     *
     * @param eyeLocation The origin location of the look ray.
     * @param target      The target entity.
     * @return The distance in blocks to the closest point of intersection on the box,
     *         or distance to the entity center if ray misses bounding box.
     */
    public static double getDistanceToBox(Location eyeLocation, Entity target) {
        if (eyeLocation == null || target == null) {
            return Double.MAX_VALUE;
        }

        BoundingBox box = target.getBoundingBox();
        Vector eyePos = eyeLocation.toVector();
        Vector direction = eyeLocation.getDirection().normalize();

        // Calculate ray-box intersection
        Vector hit = box.rayTrace(eyePos, direction, 10.0) != null
                ? box.rayTrace(eyePos, direction, 10.0).getHitPosition()
                : null;

        if (hit != null) {
            return eyePos.distance(hit);
        }

        // Fallback: closest point on the bounding box to eye position
        double clampedX = MathUtil.clamp(eyePos.getX(), box.getMinX(), box.getMaxX());
        double clampedY = MathUtil.clamp(eyePos.getY(), box.getMinY(), box.getMaxY());
        double clampedZ = MathUtil.clamp(eyePos.getZ(), box.getMinZ(), box.getMaxZ());
        Vector closest = new Vector(clampedX, clampedY, clampedZ);

        return eyePos.distance(closest);
    }

    /**
     * Calculates the angle in degrees between the player's view vector and the vector pointing to the target.
     *
     * @param eyeLocation Eye location of the attacker.
     * @param targetLocation Center/Eye location of the target.
     * @return Offset angle in degrees [0, 180].
     */
    public static double getAngleOffset(Location eyeLocation, Location targetLocation) {
        if (eyeLocation == null || targetLocation == null) {
            return 180.0;
        }

        Vector viewVector = eyeLocation.getDirection().normalize();
        Vector targetVector = targetLocation.toVector().subtract(eyeLocation.toVector()).normalize();

        double dot = viewVector.dot(targetVector);
        dot = MathUtil.clamp(dot, -1.0, 1.0);

        return Math.toDegrees(Math.acos(dot));
    }
}
