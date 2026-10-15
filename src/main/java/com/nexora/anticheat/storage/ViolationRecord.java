package com.nexora.anticheat.storage;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Historical record of a logged anti-cheat violation.
 */
public record ViolationRecord(
        UUID playerUuid,
        String playerName,
        String checkId,
        double vl,
        String details,
        int ping,
        long timestamp
) {
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
            .withZone(ZoneId.systemDefault());

    public String formattedTime() {
        return FORMATTER.format(Instant.ofEpochMilli(timestamp));
    }
}
