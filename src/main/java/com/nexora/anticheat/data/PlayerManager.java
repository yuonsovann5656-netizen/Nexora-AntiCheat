package com.nexora.anticheat.data;

import com.nexora.anticheat.NexoraPlugin;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerRespawnEvent;
import org.bukkit.event.player.PlayerTeleportEvent;
import org.bukkit.event.player.PlayerVelocityEvent;
import com.nexora.anticheat.util.BedrockUtil;
import org.bukkit.util.Vector;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages the lifecycle of PlayerData instances and hooks core Bukkit state transition events.
 */
public class PlayerManager implements Listener {

    private final NexoraPlugin plugin;
    private final Map<UUID, PlayerData> playerDataMap = new ConcurrentHashMap<>();

    public PlayerManager(@NotNull NexoraPlugin plugin) {
        this.plugin = plugin;
    }

    @NotNull
    public PlayerData getOrCreate(@NotNull Player player) {
        return playerDataMap.computeIfAbsent(player.getUniqueId(),
                uuid -> new PlayerData(uuid, player.getName()));
    }

    @Nullable
    public PlayerData getData(@NotNull Player player) {
        return playerDataMap.get(player.getUniqueId());
    }

    @Nullable
    public PlayerData getData(@NotNull UUID uuid) {
        return playerDataMap.get(uuid);
    }

    @NotNull
    public Collection<PlayerData> getAllData() {
        return playerDataMap.values();
    }

    public void remove(@NotNull UUID uuid) {
        playerDataMap.remove(uuid);
    }

    public void clearAll() {
        playerDataMap.clear();
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        PlayerData data = getOrCreate(player);
        data.setUsername(player.getName());
        data.setLastSafeGroundLocation(player.getLocation());
        data.addLocationRecord(player.getLocation(), player.isOnGround());
        // Resolve and cache whether this player is a Bedrock client
        BedrockUtil.onPlayerJoin(player);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        // Complete memory cleanup on player quit
        BedrockUtil.onPlayerQuit(event.getPlayer());
        playerDataMap.remove(event.getPlayer().getUniqueId());
        // Clean up AntiDupeCheck per-player state
        com.nexora.anticheat.check.world.AntiDupeCheck antiDupe =
                (com.nexora.anticheat.check.world.AntiDupeCheck)
                        plugin.getCheckManager().getCheck("AntiDupe");
        if (antiDupe != null) {
            antiDupe.cleanup(event.getPlayer().getUniqueId());
        }
        // Clean up AI Detection Engine per-player profile
        if (plugin.getAiDetectionEngine() != null) {
            plugin.getAiDetectionEngine().cleanup(event.getPlayer().getUniqueId());
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPlayerTeleport(PlayerTeleportEvent event) {
        PlayerData data = getData(event.getPlayer());
        if (data != null) {
            data.registerTeleport();
            data.setLastSafeGroundLocation(event.getTo());
            data.addLocationRecord(event.getTo(), event.getPlayer().isOnGround());
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerRespawn(PlayerRespawnEvent event) {
        PlayerData data = getData(event.getPlayer());
        if (data != null) {
            data.registerRespawn();
            data.setLastSafeGroundLocation(event.getRespawnLocation());
            data.addLocationRecord(event.getRespawnLocation(), true);
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPlayerVelocity(PlayerVelocityEvent event) {
        PlayerData data = getData(event.getPlayer());
        if (data != null) {
            Vector v = event.getVelocity();
            data.registerServerVelocity(v.getX(), v.getY(), v.getZ());
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onEntityDamage(EntityDamageEvent event) {
        if (event.getEntity() instanceof Player player) {
            PlayerData data = getData(player);
            if (data != null) {
                // Damage can cause knockback or damage-tick delays
                data.registerServerVelocity(0.1, 0.4, 0.1);
            }
        }
    }
}
