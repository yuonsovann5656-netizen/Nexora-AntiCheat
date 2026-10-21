package com.nexora.anticheat.check.player;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.TaskUtil;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.Action;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerItemHeldEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerRegisterChannelEvent;
import org.jetbrains.annotations.NotNull;

import java.util.ArrayList;
import java.util.List;

/**
 * Detects and blocks macro modifications, MultiKeybinds, and unauthorized PvP client mods.
 *
 * <p>Features:
 * <ul>
 *   <li><b>PVP Mod Scanner</b>: Scans handshake plugin channels and client packets for blacklisted
 *       PvP mods (MultiKeybinds, Freecam, AutoTotem, Minimap Radars, Tweakeroo, Baritone, Printer).</li>
 *   <li><b>Simultaneous Action Blocker</b>: Intercepts and cancels multi-action bursts occurring in
 *       the exact same millisecond or game tick (< 15 ms).</li>
 *   <li><b>Fast Hotbar Swap Blocker</b>: Prevents automated slot cycling (> 4 swaps in < 100 ms).</li>
 * </ul>
 */
public class MacroKeybindCheck extends Check {

    private int maxActionsPerTick = 2;
    private int maxSlotSwapsPerWindow = 4;
    private long slotWindowMs = 100L;
    private boolean scanBannedMods = true;

    private List<String> bannedPvpMods = new ArrayList<>(List.of(
            "multikeybinds", "multikeybind", "macrokeybind", "macros",
            "autoclicker", "autototem", "fastswap", "totem",
            "freecam", "mcfreecam", "itemscroller", "tweakeroo",
            "schematica", "litematica", "baritone", "betterpvp",
            "voxelmap", "xaerominimap", "xaeroworldmap", "journeymap",
            "minihud", "mousetweaks", "rebind"
    ));

    public MacroKeybindCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "MultiKeybinds", "MultiKeybinds (PVP Mod Scanner & Macro)", CheckCategory.PLAYER);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.maxActionsPerTick = config.getInt(path + ".max-actions-per-tick", 2);
        this.maxSlotSwapsPerWindow = config.getInt(path + ".max-slot-swaps-per-window", 4);
        this.slotWindowMs = config.getLong(path + ".slot-window-ms", 100L);
        this.scanBannedMods = config.getBoolean(path + ".scan-banned-mods", true);

        List<String> list = config.getStringList(path + ".banned-pvp-mods");
        if (list != null && !list.isEmpty()) {
            this.bannedPvpMods = new ArrayList<>(list);
        }
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onPlayerInteract(PlayerInteractEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

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
        if (!scanBannedMods) return;

        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        String channel = event.getChannel().toLowerCase();
        inspectAndBlockModChannel(player, data, channel);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        if (!scanBannedMods) return;

        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        // Schedule delayed scan of listening plugin channels after initial handshakes settle
        TaskUtil.runEntityLater(plugin, player, () -> {
            if (!player.isOnline()) return;

            for (String ch : player.getListeningPluginChannels()) {
                inspectAndBlockModChannel(player, data, ch.toLowerCase());
            }
        }, 15L);
    }

    /**
     * Scans and intercepts unauthorized PvP mod channels.
     */
    public boolean inspectAndBlockModChannel(@NotNull Player player, @NotNull PlayerData data, @NotNull String channel) {
        for (String bannedMod : bannedPvpMods) {
            String lowerBanned = bannedMod.toLowerCase();
            if (channel.contains(lowerBanned)) {
                data.addDetectedBannedMod(bannedMod);

                String alertMsg = String.format(
                        "<#FF0000>[Bayon AntiCheat]</#FF0000> <red><yellow>%s</yellow> connected with illegal PvP mod: <yellow>%s</yellow> <dark_gray>(%s)</dark_gray></red>",
                        player.getName(), bannedMod, channel
                );

                for (Player staff : Bukkit.getOnlinePlayers()) {
                    if (staff.hasPermission("bayon.alerts") || staff.hasPermission("nexora.alerts")) {
                        staff.sendMessage(MiniMessage.miniMessage().deserialize(alertMsg));
                    }
                }

                flag(player, data, String.format("Illegal PvP Mod detected: %s (Channel: %s)", bannedMod, channel), getMaxVl());
                return true;
            }
        }
        return false;
    }

    public List<String> getBannedPvpMods() {
        return bannedPvpMods;
    }
}
