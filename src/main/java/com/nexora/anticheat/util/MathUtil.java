package com.nexora.anticheat.util;

import java.util.Collection;

/**
 * High-performance mathematical and statistical utilities used across anti-cheat detections.
 */
public final class MathUtil {

    private MathUtil() {
        // Utility class
    }

    /**
     * Normalizes an angle into the [-180, 180] degree range.
     *
     * @param angle The raw angle in degrees.
     * @return The normalized angle in degrees.
     */
    public static float normalizeAngle(float angle) {
        float normalized = angle % 360.0F;
        while (normalized <= -180.0F) {
            normalized += 360.0F;
        }
        while (normalized > 180.0F) {
            normalized -= 360.0F;
        }
        return normalized;
    }

    /**
     * Calculates the absolute minimal angular difference between two yaw angles.
     *
     * @param yaw1 The first yaw angle.
     * @param yaw2 The second yaw angle.
     * @return The absolute degree difference in [0, 180].
     */
    public static float getAngleDistance(float yaw1, float yaw2) {
        float diff = Math.abs(normalizeAngle(yaw1) - normalizeAngle(yaw2));
        if (diff > 180.0F) {
            diff = 360.0F - diff;
        }
        return diff;
    }

    /**
     * Calculates the horizontal distance between two coordinate pairs.
     *
     * @param x1 First X coordinate.
     * @param z1 First Z coordinate.
     * @param x2 Second X coordinate.
     * @param z2 Second Z coordinate.
     * @return The 2D Euclidean distance.
     */
    public static double distanceHorizontal(double x1, double z1, double x2, double z2) {
        double dx = x2 - x1;
        double dz = z2 - z1;
        return Math.sqrt(dx * dx + dz * dz);
    }

    /**
     * Calculates the statistical variance of a collection of numerical samples.
     *
     * @param data The collection of numbers.
     * @return The variance, or 0.0 if insufficient data.
     */
    public static double getVariance(Collection<? extends Number> data) {
        if (data == null || data.size() < 2) {
            return 0.0;
        }

        double sum = 0.0;
        for (Number num : data) {
            sum += num.doubleValue();
        }
        double mean = sum / data.size();

        double temp = 0.0;
        for (Number num : data) {
            double diff = num.doubleValue() - mean;
            temp += diff * diff;
        }

        return temp / (data.size() - 1);
    }

    /**
     * Calculates the statistical standard deviation of a collection of numerical samples.
     *
     * @param data The collection of numbers.
     * @return The standard deviation, or 0.0 if insufficient data.
     */
    public static double getStandardDeviation(Collection<? extends Number> data) {
        return Math.sqrt(getVariance(data));
    }

    /**
     * Clamps a value within specified boundaries.
     *
     * @param value The value to clamp.
     * @param min   The minimum allowed value.
     * @param max   The maximum allowed value.
     * @return The clamped value.
     */
    public static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }
}
