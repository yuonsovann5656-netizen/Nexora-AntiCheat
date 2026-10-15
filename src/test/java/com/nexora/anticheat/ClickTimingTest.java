package com.nexora.anticheat;

import com.nexora.anticheat.data.PlayerData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ClickTimingTest {

    @Test
    @DisplayName("Should track clicks and report CPS within temporal window")
    void testCpsCalculation() {
        PlayerData data = new PlayerData(UUID.randomUUID(), "TestPlayer");

        assertEquals(0.0, data.getCps(), 0.001);

        for (int i = 0; i < 15; i++) {
            data.registerLeftClick();
        }

        assertEquals(15.0, data.getCps(), 0.001);
    }

    @Test
    @DisplayName("Should detect macro click consistency with low variance")
    void testClickVariance() {
        PlayerData data = new PlayerData(UUID.randomUUID(), "MacroPlayer");

        // Simulate identical interval clicks (macro behavior)
        for (int i = 0; i < 25; i++) {
            data.registerLeftClick();
        }

        // Extremely fast repeated calls in the same millisecond have ~0 variance
        double variance = data.getClickIntervalVariance();
        assertTrue(variance < 5.0, "Expected low variance for rapid uniform clicks, got " + variance);
    }
}
