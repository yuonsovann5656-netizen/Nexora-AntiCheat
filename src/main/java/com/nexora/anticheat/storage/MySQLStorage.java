package com.nexora.anticheat.storage;

import com.nexora.anticheat.punishment.BanRecord;
import com.nexora.anticheat.punishment.IpBanRecord;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * High-performance remote MySQL database storage backed by HikariCP.
 */
public class MySQLStorage implements DatabaseStorage {

    private final String host;
    private final int port;
    private final String database;
    private final String username;
    private final String password;
    private final int maxPoolSize;

    private HikariDataSource dataSource;

    public MySQLStorage(String host, int port, String database, String username, String password, int maxPoolSize) {
        this.host = host;
        this.port = port;
        this.database = database;
        this.username = username;
        this.password = password;
        this.maxPoolSize = maxPoolSize;
    }

    @Override
    public void init() throws Exception {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:mysql://" + host + ":" + port + "/" + database + "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC");
        config.setUsername(username);
        config.setPassword(password);
        config.setMaximumPoolSize(Math.max(2, maxPoolSize));
        config.setPoolName("Nexora-HikariPool");

        this.dataSource = new HikariDataSource(config);

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS nexora_violations (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    uuid VARCHAR(36) NOT NULL,
                    player VARCHAR(16) NOT NULL,
                    check_id VARCHAR(32) NOT NULL,
                    vl DOUBLE NOT NULL,
                    details TEXT,
                    ping INT NOT NULL,
                    timestamp BIGINT NOT NULL,
                    INDEX idx_uuid (uuid),
                    INDEX idx_player (player),
                    INDEX idx_timestamp (timestamp)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """);

            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS nexora_bans (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    uuid VARCHAR(36) NOT NULL,
                    player VARCHAR(16) NOT NULL,
                    reason TEXT NOT NULL,
                    check_id VARCHAR(32),
                    banned_by VARCHAR(32) NOT NULL,
                    banned_at BIGINT NOT NULL,
                    expires_at BIGINT,
                    duration_ms BIGINT,
                    tier INT NOT NULL,
                    active TINYINT(1) NOT NULL DEFAULT 1,
                    ip VARCHAR(45),
                    INDEX idx_bans_uuid (uuid),
                    INDEX idx_bans_player (player),
                    INDEX idx_bans_active (active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """);

            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS nexora_ip_bans (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    ip VARCHAR(45) NOT NULL,
                    uuid VARCHAR(36),
                    player VARCHAR(16),
                    reason TEXT NOT NULL,
                    banned_at BIGINT NOT NULL,
                    banned_by VARCHAR(32) NOT NULL,
                    active TINYINT(1) NOT NULL DEFAULT 1,
                    INDEX idx_ip (ip),
                    INDEX idx_active (active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """);

            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS nexora_kick_counts (
                    uuid VARCHAR(36) PRIMARY KEY,
                    player VARCHAR(16) NOT NULL,
                    kick_count INT NOT NULL DEFAULT 0,
                    last_kick_at BIGINT NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """);
        }
    }

    @Override
    public void logViolation(ViolationRecord record) throws Exception {
        String sql = "INSERT INTO nexora_violations (uuid, player, check_id, vl, details, ping, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
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
    public List<ViolationRecord> getHistory(UUID playerUuid, int limit) throws Exception {
        List<ViolationRecord> results = new ArrayList<>();
        String sql = "SELECT uuid, player, check_id, vl, details, ping, timestamp FROM nexora_violations WHERE uuid = ? ORDER BY timestamp DESC LIMIT ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
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
    public List<ViolationRecord> getHistoryByName(String playerName, int limit) throws Exception {
        List<ViolationRecord> results = new ArrayList<>();
        String sql = "SELECT uuid, player, check_id, vl, details, ping, timestamp FROM nexora_violations WHERE LOWER(player) = LOWER(?) ORDER BY timestamp DESC LIMIT ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
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
    public List<String> getRecordedPlayerNames() throws Exception {
        List<String> names = new ArrayList<>();
        String sql = "SELECT DISTINCT player FROM nexora_violations";
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                names.add(rs.getString("player"));
            }
        }
        return names;
    }

    @Override
    public void saveBan(BanRecord record) throws Exception {
        String sql = "INSERT INTO nexora_bans (uuid, player, reason, check_id, banned_by, banned_at, expires_at, duration_ms, tier, active, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, record.uuid().toString());
            ps.setString(2, record.playerName());
            ps.setString(3, record.reason());
            ps.setString(4, record.checkId());
            ps.setString(5, record.bannedBy());
            ps.setLong(6, record.bannedAt());
            if (record.expiresAt() != null) {
                ps.setLong(7, record.expiresAt());
            } else {
                ps.setNull(7, Types.BIGINT);
            }
            if (record.durationMs() != null) {
                ps.setLong(8, record.durationMs());
            } else {
                ps.setNull(8, Types.BIGINT);
            }
            ps.setInt(9, record.tier());
            ps.setInt(10, record.active() ? 1 : 0);
            ps.setString(11, record.ipAddress());
            ps.executeUpdate();
        }
    }

    @Override
    public BanRecord getActiveBan(UUID playerUuid) throws Exception {
        String sql = "SELECT id, uuid, player, reason, check_id, banned_by, banned_at, expires_at, duration_ms, tier, active, ip FROM nexora_bans WHERE uuid = ? AND active = 1 ORDER BY id DESC LIMIT 1";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
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
    public BanRecord getActiveBanByName(String playerName) throws Exception {
        String sql = "SELECT id, uuid, player, reason, check_id, banned_by, banned_at, expires_at, duration_ms, tier, active, ip FROM nexora_bans WHERE LOWER(player) = LOWER(?) AND active = 1 ORDER BY id DESC LIMIT 1";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
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
    public List<BanRecord> getBanHistory(UUID playerUuid, int limit) throws Exception {
        List<BanRecord> results = new ArrayList<>();
        String sql = "SELECT id, uuid, player, reason, check_id, banned_by, banned_at, expires_at, duration_ms, tier, active, ip FROM nexora_bans WHERE uuid = ? ORDER BY id DESC LIMIT ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
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
    public List<BanRecord> getBanHistoryByName(String playerName, int limit) throws Exception {
        List<BanRecord> results = new ArrayList<>();
        String sql = "SELECT id, uuid, player, reason, check_id, banned_by, banned_at, expires_at, duration_ms, tier, active, ip FROM nexora_bans WHERE LOWER(player) = LOWER(?) ORDER BY id DESC LIMIT ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
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
    public void deactivateBansForPlayer(UUID playerUuid) throws Exception {
        String sql = "UPDATE nexora_bans SET active = 0 WHERE uuid = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, playerUuid.toString());
            ps.executeUpdate();
        }
    }

    @Override
    public void deactivateBansForPlayerName(String playerName) throws Exception {
        String sql = "UPDATE nexora_bans SET active = 0 WHERE LOWER(player) = LOWER(?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, playerName);
            ps.executeUpdate();
        }
    }

    @Override
    public void saveIpBan(IpBanRecord record) throws Exception {
        String sql = "INSERT INTO nexora_ip_bans (ip, uuid, player, reason, banned_at, banned_by, active) VALUES (?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
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
    public IpBanRecord getActiveIpBan(String ipAddress) throws Exception {
        String sql = "SELECT id, ip, uuid, player, reason, banned_at, banned_by, active FROM nexora_ip_bans WHERE ip = ? AND active = 1 ORDER BY id DESC LIMIT 1";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
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
    public void deactivateIpBan(String ipAddress) throws Exception {
        String sql = "UPDATE nexora_ip_bans SET active = 0 WHERE ip = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, ipAddress);
            ps.executeUpdate();
        }
    }

    @Override
    public int getKickCount(UUID playerUuid) throws Exception {
        String sql = "SELECT kick_count FROM nexora_kick_counts WHERE uuid = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
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
    public void incrementKickCount(UUID playerUuid, String playerName) throws Exception {
        String sql = """
            INSERT INTO nexora_kick_counts (uuid, player, kick_count, last_kick_at)
            VALUES (?, ?, 1, ?)
            ON DUPLICATE KEY UPDATE
                player = VALUES(player),
                kick_count = kick_count + 1,
                last_kick_at = VALUES(last_kick_at);
        """;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, playerUuid.toString());
            ps.setString(2, playerName);
            ps.setLong(3, System.currentTimeMillis());
            ps.executeUpdate();
        }
    }

    @Override
    public void resetKickCount(UUID playerUuid) throws Exception {
        String sql = "UPDATE nexora_kick_counts SET kick_count = 0 WHERE uuid = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, playerUuid.toString());
            ps.executeUpdate();
        }
    }

    @Override
    public void resetKickCountByName(String playerName) throws Exception {
        String sql = "UPDATE nexora_kick_counts SET kick_count = 0 WHERE LOWER(player) = LOWER(?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
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
    public void close() {
        if (dataSource != null && !dataSource.isClosed()) {
            dataSource.close();
        }
    }
}
