package com.nexora.anticheat.storage;

import com.nexora.anticheat.punishment.BanRecord;
import com.nexora.anticheat.punishment.IpBanRecord;

import java.util.List;
import java.util.UUID;

/**
 * Common contract for persistence providers (SQLite, MySQL).
 */
public interface DatabaseStorage {

    void init() throws Exception;

    void logViolation(ViolationRecord record) throws Exception;

    List<ViolationRecord> getHistory(UUID playerUuid, int limit) throws Exception;

    List<ViolationRecord> getHistoryByName(String playerName, int limit) throws Exception;

    List<String> getRecordedPlayerNames() throws Exception;

    // --- Ban & Progressive Punishment Methods ---

    void saveBan(BanRecord record) throws Exception;

    BanRecord getActiveBan(UUID playerUuid) throws Exception;

    BanRecord getActiveBanByName(String playerName) throws Exception;

    List<BanRecord> getBanHistory(UUID playerUuid, int limit) throws Exception;

    List<BanRecord> getBanHistoryByName(String playerName, int limit) throws Exception;

    void deactivateBansForPlayer(UUID playerUuid) throws Exception;

    void deactivateBansForPlayerName(String playerName) throws Exception;

    // --- IP Ban Methods ---

    void saveIpBan(IpBanRecord record) throws Exception;

    IpBanRecord getActiveIpBan(String ipAddress) throws Exception;

    void deactivateIpBan(String ipAddress) throws Exception;

    // --- Kick Counter Methods ---

    int getKickCount(UUID playerUuid) throws Exception;

    void incrementKickCount(UUID playerUuid, String playerName) throws Exception;

    void resetKickCount(UUID playerUuid) throws Exception;

    void resetKickCountByName(String playerName) throws Exception;

    void close();
}
