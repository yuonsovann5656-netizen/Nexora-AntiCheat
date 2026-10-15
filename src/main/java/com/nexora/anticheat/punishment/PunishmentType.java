package com.nexora.anticheat.punishment;

/**
 * Standard punishment actions supported by Nexora AntiCheat.
 */
public enum PunishmentType {
    SETBACK,
    WARN,
    KICK,
    BAN,
    COMMAND,
    BLOCK;

    public static PunishmentType fromString(String str, PunishmentType def) {
        if (str == null) return def;
        try {
            return valueOf(str.toUpperCase());
        } catch (IllegalArgumentException e) {
            return def;
        }
    }
}
