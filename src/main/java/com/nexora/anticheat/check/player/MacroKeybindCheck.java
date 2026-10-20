package com.nexora.anticheat.check.player;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.Action;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerItemHeldEvent;
import org.bukkit.event.player.PlayerRegisterChannelEvent;
import org.jetbrains.annotations.NotNull;

import java.util.Set;

/**
 * Detects and blocks macro and multi-keybind modifications (MultiKeybinds, Macro Keybind, Fast-Swap).
 *
 * <p>Prevents clients from executing multiple simultaneous physical interactions (e.g. attacking,
 * block placing, and item consuming in 0 ms) or spamming hotbar slot changes at inhuman speeds.
 */
public class MacroKeybindCheck extends Check {

    private int maxActionsPerTick = 2;
    private int maxSlotSwapsPerWindow = 4;
    private long slotWindowMs = 100L;

    private static final Set<String> MACRO_CHANNELS = Set.of(
            "multikeybinds", "multikeybind", "macrokeybind", "macros",
            "macros:execute", "tweakeroo", "tweakeroo:client"
    );

    public MacroKeybindCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "MultiKeybinds", "MultiKeybinds (Macro Exploit)", CheckCategory.PLAYER);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.maxActionsPerTick = config.getInt(path + ".max-actions-per-tick", 2);
        this.maxSlotSwapsPerWindow = config.getInt(path + ".max-slot-swaps-per-window", 4);
        this.slotWindowMs = config.getLong(path + ".slot-window-ms", 100L);
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onPlayerInteract(PlayerInteractEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        // Only track meaningful block/item interactions (not physical pressure plate walks)
        if (event.getAction() == Action.PHYSICAL) {
            return;
        }

        long now = System.currentTimeMillis();
        long diff = now - data.getLastActionTimestamp();

        if (diff < 15L) {
            int count = data.getActionsThisTick() + 1;
            data.setActionsThisTick(count);

            if (count > maxActionsPerTick) {
                event.setCancelled(true);
                flag(player, data,
                     String.format("MultiKeybind burst: %d simultaneous actions in %d ms", count, diff),
                     1.5);
                return;
            }
        } else {
            data.setActionsThisTick(1);
            data.setLastActionTimestamp(now);
        }
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onEntityDamage(EntityDamageByEntityEvent event) {
        if (!(event.getDamager() instanceof Player player)) {
            return;
        }

        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        long now = System.currentTimeMillis();
        long diff = now - data.getLastActionTimestamp();

        // Impossible human latency: attacking an entity at the exact same millisecond as another action
        if (diff < 15L) {
            int count = data.getActionsThisTick() + 1;
            data.setActionsThisTick(count);

            if (count > maxActionsPerTick) {
                event.setCancelled(true);
                flag(player, data,
                     String.format("MultiKeybind attack burst: %d simultaneous actions in %d ms", count, diff),
                     2.0);
                return;
            }
        } else {
            data.setActionsThisTick(1);
            data.setLastActionTimestamp(now);
        }
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onItemHeld(PlayerItemHeldEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        long now = System.currentTimeMillis();
        long diff = now - data.getLastSlotSwapTimestamp();

        if (diff < slotWindowMs) {
            int swaps = data.getSlotSwapsInWindow() + 1;
            data.setSlotSwapsInWindow(swaps);

            if (swaps > maxSlotSwapsPerWindow) {
                event.setCancelled(true);
                flag(player, data,
                     String.format("Fast hotbar macro cycle: %d swaps in %d ms", swaps, diff),
                     1.0);
            }
        } else {
            data.setSlotSwapsInWindow(1);
            data.setLastSlotSwapTimestamp(now);
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onChannelRegister(PlayerRegisterChannelEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        String channel = event.getChannel().toLowerCase();
        if (MACRO_CHANNELS.contains(channel) || channel.contains("multikeybind") || channel.contains("macrokeybind")) {
            flag(player, data, "Registered illegal macro keybind channel: " + channel, getMaxVl());
        }
    }
}
