package com.nexora.anticheat.punishment;

import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Data model representing an IP address ban.
 */
public record IpBanRecord(
        int id,
        @NotNull String ipAddress,
        @Nullable UUID uuid,
        @Nullable String playerName,
        @NotNull String reason,
        long bannedAt,
        @NotNull String bannedBy,
        boolean active
) {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
            .withZone(ZoneId.systemDefault());

    public String formattedBannedAt() {
        return FORMATTER.format(Instant.ofEpochMilli(bannedAt));
    }
}
