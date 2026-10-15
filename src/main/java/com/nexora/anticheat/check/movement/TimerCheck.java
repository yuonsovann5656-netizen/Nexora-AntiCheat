package com.nexora.anticheat.check.movement;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.player.PlayerMoveEvent;
import org.jetbrains.annotations.NotNull;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Detects Timer hacks by analyzing client movement packet frequency and clock drift.
 */
public class TimerCheck extends Check {

    private int maxPacketsPerSecond = 24;
    private final Map<UUID, Long> windowStartMap = new ConcurrentHashMap<>();
    private final Map<UUID, Integer> packetCountMap = new ConcurrentHashMap<>();

    public TimerCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Timer", "Timer (Game Clock Modification)", CheckCategory.MOVEMENT);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.maxPacketsPerSecond = config.getInt(path + ".max-packets-per-second", 24);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        UUID uuid = player.getUniqueId();
        long now = System.currentTimeMillis();

        long windowStart = windowStartMap.computeIfAbsent(uuid, k -> now);
        int count = packetCountMap.compute(uuid, (k, v) -> v == null ? 1 : v + 1);

        if (now - windowStart >= 1000L) {
            if (count > maxPacketsPerSecond) {
                flag(player, data, String.format("Packets: %d/s > Max: %d/s", count, maxPacketsPerSecond), 1.0);
            }
            windowStartMap.put(uuid, now);
            packetCountMap.put(uuid, 0);
        }
    }
}
