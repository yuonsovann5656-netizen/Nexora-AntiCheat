package com.nexora.anticheat.check.player;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.jetbrains.annotations.NotNull;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Detects InventoryMove hacks where players manipulate inventory items while sprinting or in combat.
 */
public class InventoryCheck extends Check {

    private int maxSprintClicks = 2;
    private final Map<UUID, Integer> sprintClickCount = new ConcurrentHashMap<>();

    public InventoryCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Inventory", "Inventory (Illegal Clicks / InvMove)", CheckCategory.PLAYER);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.maxSprintClicks = config.getInt(path + ".max-sprint-clicks", 2);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onInventoryClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player player)) {
            return;
        }

        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        // Vanilla clients cannot sprint while having an inventory container open and clicking items
        if (player.isSprinting()) {
            int count = sprintClickCount.compute(player.getUniqueId(), (k, v) -> v == null ? 1 : v + 1);
            if (count > maxSprintClicks) {
                flag(player, data, String.format("InvMove: %d item clicks while in active sprint state", count), 1.0);
            }
        } else {
            sprintClickCount.remove(player.getUniqueId());
        }
    }
}
