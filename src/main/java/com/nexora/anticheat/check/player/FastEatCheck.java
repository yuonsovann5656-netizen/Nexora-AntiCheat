package com.nexora.anticheat.check.player;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.Material;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerItemConsumeEvent;
import org.bukkit.inventory.ItemStack;
import org.jetbrains.annotations.NotNull;

/**
 * Detects FastEat and FastUse cheats where items or consumables are used in abnormally short intervals.
 */
public class FastEatCheck extends Check {

    private long minConsumeDurationMs = 1350L; // 27 ticks (vanilla is 32 ticks = 1600ms)

    public FastEatCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "FastEat", "FastEat / FastUse (Consumable Timers)", CheckCategory.PLAYER);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        int minTicks = config.getInt(path + ".min-eat-ticks", 28);
        this.minConsumeDurationMs = minTicks * 50L;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onInteract(PlayerInteractEvent event) {
        if (event.getAction() != Action.RIGHT_CLICK_AIR && event.getAction() != Action.RIGHT_CLICK_BLOCK) {
            return;
        }

        Player player = event.getPlayer();
        ItemStack item = event.getItem();
        if (item != null && (item.getType().isEdible() || item.getType() == Material.POTION || item.getType() == Material.MILK_BUCKET)) {
            PlayerData data = plugin.getPlayerDataManager().getData(player);
            if (data != null) {
                data.registerItemUseStart();
            }
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onItemConsume(PlayerItemConsumeEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        long startTime = data.getItemUseStartTimestamp();
        if (startTime == 0L) {
            return;
        }

        long duration = System.currentTimeMillis() - startTime;
        if (duration < minConsumeDurationMs) {
            flag(player, data, String.format("FastEat: consumed %s in %dms < min %dms",
                    event.getItem().getType(), duration, minConsumeDurationMs), 1.0);
        }
    }
}
