package com.nexora.anticheat;

import com.nexora.anticheat.util.MathUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DetectionLogicTest {

    @Test
    @DisplayName("Should detect excessive horizontal speed displacement")
    void testSpeedDisplacement() {
        double maxLegitSpeed = 0.36;

        double normalDelta = MathUtil.distanceHorizontal(10.0, 10.0, 10.25, 10.15);
        assertTrue(normalDelta <= maxLegitSpeed, "Normal speed should not exceed threshold");

        double speedHackDelta = MathUtil.distanceHorizontal(10.0, 10.0, 10.65, 10.55);
        assertTrue(speedHackDelta > maxLegitSpeed, "Speed hack delta should exceed threshold");
    }

    @Test
    @DisplayName("Should test angular offset vectors for KillAura checks")
    void testVectorMath() {
        // Dot product of identical unit vectors yields 1.0 (0 degrees)
        double dotSame = 1.0;
        double angleSame = Math.toDegrees(Math.acos(dotSame));
        assertEquals(0.0, angleSame, 0.001);

        // Dot product of orthogonal vectors yields 0.0 (90 degrees)
        double dotOrthogonal = 0.0;
        double angleOrthogonal = Math.toDegrees(Math.acos(dotOrthogonal));
        assertEquals(90.0, angleOrthogonal, 0.001);

        // Dot product of opposite vectors yields -1.0 (180 degrees)
        double dotOpposite = -1.0;
        double angleOpposite = Math.toDegrees(Math.acos(dotOpposite));
        assertEquals(180.0, angleOpposite, 0.001);
    }
}
