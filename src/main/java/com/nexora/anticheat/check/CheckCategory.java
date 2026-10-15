package com.nexora.anticheat.check;

/**
 * Functional categories for anti-cheat detections.
 */
public enum CheckCategory {
    MOVEMENT("Movement"),
    COMBAT("Combat"),
    WORLD("World"),
    PLAYER("Player");

    private final String displayName;

    CheckCategory(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
