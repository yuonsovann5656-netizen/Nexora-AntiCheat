package com.nexora.anticheat.punishment;

import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Data model representing a ban entry for a player.
 */
public record BanRecord(
        int id,
        @NotNull UUID uuid,
        @NotNull String playerName,
        @NotNull String reason,
        @Nullable String checkId,
        @NotNull String bannedBy,
        long bannedAt,
        @Nullable Long expiresAt,
        @Nullable Long durationMs,
        int tier,
        boolean active,
        @Nullable String ipAddress
) {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
            .withZone(ZoneId.systemDefault());

    public boolean isPermanent() {
        return expiresAt == null || expiresAt <= 0;
    }

    public boolean isExpired() {
        if (isPermanent()) {
            return false;
        }
        return System.currentTimeMillis() >= expiresAt;
    }

    public String formattedBannedAt() {
        return FORMATTER.format(Instant.ofEpochMilli(bannedAt));
    }

    public String formattedExpiresAt() {
        if (isPermanent()) {
            return "Permanent (Lifetime)";
        }
        return FORMATTER.format(Instant.ofEpochMilli(expiresAt));
    }

    public String tierDescription() {
        return switch (tier) {
            case 1 -> "24 Hours (Tier 1)";
            case 2 -> "7 Days (Tier 2)";
            case 3 -> "30 Days (Tier 3)";
            default -> "Permanent / Lifetime (Tier 4)";
        };
    }
}
