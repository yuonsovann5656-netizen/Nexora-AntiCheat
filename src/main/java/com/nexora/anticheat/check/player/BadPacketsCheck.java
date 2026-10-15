package com.nexora.anticheat.check.player;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.player.PlayerItemHeldEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.jetbrains.annotations.NotNull;

/**
 * Detects protocol level abnormalities, out-of-bound hotbar slots, and invalid packet sequences.
 */
public class BadPacketsCheck extends Check {

    public BadPacketsCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "BadPackets", "BadPackets (Protocol / Slot Bounds)", CheckCategory.PLAYER);
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onItemHeld(PlayerItemHeldEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null) {
            return;
        }

        int newSlot = event.getNewSlot();
        int previousSlot = event.getPreviousSlot();

        // Valid vanilla hotbar slots are strictly 0 through 8
        if (newSlot < 0 || newSlot > 8 || previousSlot < 0 || previousSlot > 8) {
            event.setCancelled(true);
            flag(player, data, String.format("Illegal hotbar slot index: new=%d, prev=%d", newSlot, previousSlot), 2.0);
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onMove(PlayerMoveEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        // Check if player is sprinting while sneaking (mutually exclusive in vanilla packet rules)
        if (player.isSprinting() && player.isSneaking()) {
            flag(player, data, "Simultaneous sprint and sneak packet state detected", 1.0);
        }
    }
}
