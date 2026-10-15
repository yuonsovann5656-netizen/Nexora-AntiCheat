package com.nexora.anticheat;

import com.nexora.anticheat.util.MathUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class MathUtilTest {

    @Test
    @DisplayName("Should normalize angles into [-180, 180] degrees correctly")
    void testNormalizeAngle() {
        assertEquals(0.0F, MathUtil.normalizeAngle(0.0F), 0.001F);
        assertEquals(180.0F, MathUtil.normalizeAngle(-180.0F), 0.001F);
        assertEquals(-90.0F, MathUtil.normalizeAngle(270.0F), 0.001F);
        assertEquals(45.0F, MathUtil.normalizeAngle(405.0F), 0.001F);
        assertEquals(-45.0F, MathUtil.normalizeAngle(-405.0F), 0.001F);
    }

    @Test
    @DisplayName("Should compute minimal angular distance between yaw values")
    void testGetAngleDistance() {
        assertEquals(10.0F, MathUtil.getAngleDistance(10.0F, 20.0F), 0.001F);
        assertEquals(20.0F, MathUtil.getAngleDistance(350.0F, 10.0F), 0.001F);
        assertEquals(180.0F, MathUtil.getAngleDistance(0.0F, 180.0F), 0.001F);
    }

    @Test
    @DisplayName("Should calculate 2D Euclidean horizontal distance accurately")
    void testDistanceHorizontal() {
        assertEquals(5.0, MathUtil.distanceHorizontal(0.0, 0.0, 3.0, 4.0), 0.001);
        assertEquals(0.0, MathUtil.distanceHorizontal(10.5, -5.2, 10.5, -5.2), 0.001);
    }

    @Test
    @DisplayName("Should calculate statistical variance and standard deviation correctly")
    void testVarianceAndStandardDeviation() {
        List<Double> identicalSamples = List.of(50.0, 50.0, 50.0, 50.0, 50.0);
        assertEquals(0.0, MathUtil.getVariance(identicalSamples), 0.001);
        assertEquals(0.0, MathUtil.getStandardDeviation(identicalSamples), 0.001);

        List<Double> variableSamples = List.of(10.0, 20.0, 30.0, 40.0, 50.0);
        // Variance for 10,20,30,40,50 is 250.0, stdev is sqrt(250) ≈ 15.811
        assertEquals(250.0, MathUtil.getVariance(variableSamples), 0.001);
        assertEquals(Math.sqrt(250.0), MathUtil.getStandardDeviation(variableSamples), 0.001);
    }

    @Test
    @DisplayName("Should clamp values accurately within limits")
    void testClamp() {
        assertEquals(10.0, MathUtil.clamp(5.0, 10.0, 20.0), 0.001);
        assertEquals(15.0, MathUtil.clamp(15.0, 10.0, 20.0), 0.001);
        assertEquals(20.0, MathUtil.clamp(25.0, 10.0, 20.0), 0.001);
    }
}
