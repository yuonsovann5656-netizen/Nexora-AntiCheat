package com.nexora.anticheat.storage;

import com.nexora.anticheat.punishment.BanRecord;
import com.nexora.anticheat.punishment.IpBanRecord;

import java.io.File;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Embedded SQLite database storage implementation for standalone deployments.
 */
public class SQLiteStorage implements DatabaseStorage {

    private final File dbFile;
    private Connection connection;

    public SQLiteStorage(File dbFile) {
        this.dbFile = dbFile;
    }

    private synchronized Connection getConnection() throws SQLException {
        if (connection == null || connection.isClosed()) {
            connection = DriverManager.getConnection("jdbc:sqlite:" + dbFile.getAbsolutePath());
        }
        return connection;
    }

    @Override
    public synchronized void init() throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Statement stmt = getConnection().createStatement()) {
            // Violations table
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS nexora_violations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uuid TEXT NOT NULL,
                    player TEXT NOT NULL,
                    check_id TEXT NOT NULL,
                    vl REAL NOT NULL,
                    details TEXT,
                    ping INTEGER,
                    timestamp INTEGER NOT NULL
                );
            """);
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_nexora_uuid ON nexora_violations(uuid);");
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_nexora_player ON nexora_violations(player);");
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_nexora_timestamp ON nexora_violations(timestamp);");

            // Bans table
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS nexora_bans (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uuid TEXT NOT NULL,
                    player TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    check_id TEXT,
                    banned_by TEXT NOT NULL,
                    banned_at INTEGER NOT NULL,
                    expires_at INTEGER,
                    duration_ms INTEGER,
                    tier INTEGER NOT NULL,
                    active INTEGER NOT NULL DEFAULT 1,
                    ip TEXT
                );
            """);
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_bans_uuid ON nexora_bans(uuid);");
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_bans_player ON nexora_bans(player);");
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_bans_active ON nexora_bans(active);");

            // IP Bans table
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS nexora_ip_bans (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ip TEXT NOT NULL,
                    uuid TEXT,
                    player TEXT,
                    reason TEXT NOT NULL,
                    banned_at INTEGER NOT NULL,
                    banned_by TEXT NOT NULL,
                    active INTEGER NOT NULL DEFAULT 1
                );
            """);
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_ip_bans_ip ON nexora_ip_bans(ip);");
            stmt.executeUpdate("CREATE INDEX IF NOT EXISTS idx_ip_bans_active ON nexora_ip_bans(active);");

            // Kick counts table
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS nexora_kick_counts (
                    uuid TEXT PRIMARY KEY,
                    player TEXT NOT NULL,
                    kick_count INTEGER NOT NULL DEFAULT 0,
                    last_kick_at INTEGER NOT NULL
                );
            """);
        }
    }

    @Override
    public synchronized void logViolation(ViolationRecord record) throws Exception {
        String sql = "INSERT INTO nexora_violations (uuid, player, check_id, vl, details, ping, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, record.playerUuid().toString());
            ps.setString(2, record.playerName());
            ps.setString(3, record.checkId());
            ps.setDouble(4, record.vl());
            ps.setString(5, record.details());
            ps.setInt(6, record.ping());
            ps.setLong(7, record.timestamp());
            ps.executeUpdate();
        }
    }

    @Override
    public synchronized List<ViolationRecord> getHistory(UUID playerUuid, int limit) throws Exception {
        List<ViolationRecord> results = new ArrayList<>();
        String sql = "SELECT uuid, player, check_id, vl, details, ping, timestamp FROM nexora_violations WHERE uuid = ? ORDER BY timestamp DESC LIMIT ?";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerUuid.toString());
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    results.add(new ViolationRecord(
                            UUID.fromString(rs.getString("uuid")),
                            rs.getString("player"),
                            rs.getString("check_id"),
                            rs.getDouble("vl"),
                            rs.getString("details"),
                            rs.getInt("ping"),
                            rs.getLong("timestamp")
                    ));
                }
            }
        }
        return results;
    }

    @Override
    public synchronized List<ViolationRecord> getHistoryByName(String playerName, int limit) throws Exception {
        List<ViolationRecord> results = new ArrayList<>();
        String sql = "SELECT uuid, player, check_id, vl, details, ping, timestamp FROM nexora_violations WHERE LOWER(player) = LOWER(?) ORDER BY timestamp DESC LIMIT ?";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerName);
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    results.add(new ViolationRecord(
                            UUID.fromString(rs.getString("uuid")),
                            rs.getString("player"),
                            rs.getString("check_id"),
                            rs.getDouble("vl"),
                            rs.getString("details"),
                            rs.getInt("ping"),
                            rs.getLong("timestamp")
                    ));
                }
            }
        }
        return results;
    }

    @Override
    public synchronized List<String> getRecordedPlayerNames() throws Exception {
        List<String> names = new ArrayList<>();
        String sql = "SELECT DISTINCT player FROM nexora_violations";
        try (Statement stmt = getConnection().createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                names.add(rs.getString("player"));
            }
        }
        return names;
    }

    // --- Ban Operations ---

    @Override
    public synchronized void saveBan(BanRecord record) throws Exception {
        String sql = "INSERT INTO nexora_bans (uuid, player, reason, check_id, banned_by, banned_at, expires_at, duration_ms, tier, active, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, record.uuid().toString());
            ps.setString(2, record.playerName());
            ps.setString(3, record.reason());
            ps.setString(4, record.checkId());
            ps.setString(5, record.bannedBy());
            ps.setLong(6, record.bannedAt());
            if (record.expiresAt() != null) {
                ps.setLong(7, record.expiresAt());
            } else {
                ps.setNull(7, Types.INTEGER);
            }
            if (record.durationMs() != null) {
                ps.setLong(8, record.durationMs());
            } else {
                ps.setNull(8, Types.INTEGER);
            }
            ps.setInt(9, record.tier());
            ps.setInt(10, record.active() ? 1 : 0);
            ps.setString(11, record.ipAddress());
            ps.executeUpdate();
        }
    }

    @Override
    public synchronized BanRecord getActiveBan(UUID playerUuid) throws Exception {
        String sql = "SELECT id, uuid, player, reason, check_id, banned_by, banned_at, expires_at, duration_ms, tier, active, ip FROM nexora_bans WHERE uuid = ? AND active = 1 ORDER BY id DESC LIMIT 1";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerUuid.toString());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapBanRecord(rs);
                }
            }
        }
        return null;
    }

    @Override
    public synchronized BanRecord getActiveBanByName(String playerName) throws Exception {
        String sql = "SELECT id, uuid, player, reason, check_id, banned_by, banned_at, expires_at, duration_ms, tier, active, ip FROM nexora_bans WHERE LOWER(player) = LOWER(?) AND active = 1 ORDER BY id DESC LIMIT 1";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerName);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapBanRecord(rs);
                }
            }
        }
        return null;
    }

    @Override
    public synchronized List<BanRecord> getBanHistory(UUID playerUuid, int limit) throws Exception {
        List<BanRecord> results = new ArrayList<>();
        String sql = "SELECT id, uuid, player, reason, check_id, banned_by, banned_at, expires_at, duration_ms, tier, active, ip FROM nexora_bans WHERE uuid = ? ORDER BY id DESC LIMIT ?";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerUuid.toString());
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    results.add(mapBanRecord(rs));
                }
            }
        }
        return results;
    }

    @Override
    public synchronized List<BanRecord> getBanHistoryByName(String playerName, int limit) throws Exception {
        List<BanRecord> results = new ArrayList<>();
        String sql = "SELECT id, uuid, player, reason, check_id, banned_by, banned_at, expires_at, duration_ms, tier, active, ip FROM nexora_bans WHERE LOWER(player) = LOWER(?) ORDER BY id DESC LIMIT ?";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerName);
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    results.add(mapBanRecord(rs));
                }
            }
        }
        return results;
    }

    @Override
    public synchronized void deactivateBansForPlayer(UUID playerUuid) throws Exception {
        String sql = "UPDATE nexora_bans SET active = 0 WHERE uuid = ?";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerUuid.toString());
            ps.executeUpdate();
        }
    }

    @Override
    public synchronized void deactivateBansForPlayerName(String playerName) throws Exception {
        String sql = "UPDATE nexora_bans SET active = 0 WHERE LOWER(player) = LOWER(?)";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerName);
            ps.executeUpdate();
        }
    }

    // --- IP Ban Operations ---

    @Override
    public synchronized void saveIpBan(IpBanRecord record) throws Exception {
        String sql = "INSERT INTO nexora_ip_bans (ip, uuid, player, reason, banned_at, banned_by, active) VALUES (?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, record.ipAddress());
            ps.setString(2, record.uuid() != null ? record.uuid().toString() : null);
            ps.setString(3, record.playerName());
            ps.setString(4, record.reason());
            ps.setLong(5, record.bannedAt());
            ps.setString(6, record.bannedBy());
            ps.setInt(7, record.active() ? 1 : 0);
            ps.executeUpdate();
        }
    }

    @Override
    public synchronized IpBanRecord getActiveIpBan(String ipAddress) throws Exception {
        String sql = "SELECT id, ip, uuid, player, reason, banned_at, banned_by, active FROM nexora_ip_bans WHERE ip = ? AND active = 1 ORDER BY id DESC LIMIT 1";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, ipAddress);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return new IpBanRecord(
                            rs.getInt("id"),
                            rs.getString("ip"),
                            rs.getString("uuid") != null ? UUID.fromString(rs.getString("uuid")) : null,
                            rs.getString("player"),
                            rs.getString("reason"),
                            rs.getLong("banned_at"),
                            rs.getString("banned_by"),
                            rs.getInt("active") == 1
                    );
                }
            }
        }
        return null;
    }

    @Override
    public synchronized void deactivateIpBan(String ipAddress) throws Exception {
        String sql = "UPDATE nexora_ip_bans SET active = 0 WHERE ip = ?";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, ipAddress);
            ps.executeUpdate();
        }
    }

    // --- Kick Counter Operations ---

    @Override
    public synchronized int getKickCount(UUID playerUuid) throws Exception {
        String sql = "SELECT kick_count FROM nexora_kick_counts WHERE uuid = ?";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerUuid.toString());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt("kick_count");
                }
            }
        }
        return 0;
    }

    @Override
    public synchronized void incrementKickCount(UUID playerUuid, String playerName) throws Exception {
        String sql = """
            INSERT INTO nexora_kick_counts (uuid, player, kick_count, last_kick_at)
            VALUES (?, ?, 1, ?)
            ON CONFLICT(uuid) DO UPDATE SET
                player = excluded.player,
                kick_count = kick_count + 1,
                last_kick_at = excluded.last_kick_at;
        """;
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerUuid.toString());
            ps.setString(2, playerName);
            ps.setLong(3, System.currentTimeMillis());
            ps.executeUpdate();
        }
    }

    @Override
    public synchronized void resetKickCount(UUID playerUuid) throws Exception {
        String sql = "UPDATE nexora_kick_counts SET kick_count = 0 WHERE uuid = ?";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerUuid.toString());
            ps.executeUpdate();
        }
    }

    @Override
    public synchronized void resetKickCountByName(String playerName) throws Exception {
        String sql = "UPDATE nexora_kick_counts SET kick_count = 0 WHERE LOWER(player) = LOWER(?)";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerName);
            ps.executeUpdate();
        }
    }

    private BanRecord mapBanRecord(ResultSet rs) throws SQLException {
        long exp = rs.getLong("expires_at");
        Long expiresAt = rs.wasNull() ? null : exp;
        long dur = rs.getLong("duration_ms");
        Long durationMs = rs.wasNull() ? null : dur;

        return new BanRecord(
                rs.getInt("id"),
                UUID.fromString(rs.getString("uuid")),
                rs.getString("player"),
                rs.getString("reason"),
                rs.getString("check_id"),
                rs.getString("banned_by"),
                rs.getLong("banned_at"),
                expiresAt,
                durationMs,
                rs.getInt("tier"),
                rs.getInt("active") == 1,
                rs.getString("ip")
        );
    }

    @Override
    public synchronized void close() {
        if (connection != null) {
            try {
                if (!connection.isClosed()) {
                    connection.close();
                }
            } catch (SQLException ignored) {
            }
        }
    }
}
