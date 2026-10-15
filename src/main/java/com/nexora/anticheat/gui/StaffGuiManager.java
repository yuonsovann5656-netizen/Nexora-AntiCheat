package com.nexora.anticheat.gui;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.punishment.PunishmentType;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.SkullMeta;
import org.jetbrains.annotations.NotNull;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Interactive staff overview GUI displaying live suspicious player metrics and quick-action tools.
 */
public class StaffGuiManager implements Listener {

    private final NexoraPlugin plugin;
    private static final Component GUI_TITLE = Component.text("Nexora AntiCheat » Staff GUI", NamedTextColor.RED, TextDecoration.BOLD);

    public StaffGuiManager(@NotNull NexoraPlugin plugin) {
        this.plugin = plugin;
    }

    public static class NexoraGuiHolder implements InventoryHolder {
        private final Inventory inventory;

        public NexoraGuiHolder(int size) {
            this.inventory = Bukkit.createInventory(this, size, GUI_TITLE);
        }

        @Override
        public @NotNull Inventory getInventory() {
            return inventory;
        }
    }

    public void openGui(@NotNull Player staff) {
        NexoraGuiHolder holder = new NexoraGuiHolder(54);
        Inventory inv = holder.getInventory();

        int slot = 0;
        for (Player target : Bukkit.getOnlinePlayers()) {
            if (slot >= 54) break;

            PlayerData data = plugin.getPlayerDataManager().getData(target);
            if (data == null) continue;

            double totalVl = data.getTotalViolationLevel();

            ItemStack head = new ItemStack(Material.PLAYER_HEAD);
            SkullMeta meta = (SkullMeta) head.getItemMeta();
            if (meta != null) {
                meta.setOwningPlayer(target);
                meta.displayName(Component.text(target.getName(), totalVl > 0 ? NamedTextColor.RED : NamedTextColor.GREEN));

                List<Component> lore = new ArrayList<>();
                lore.add(Component.text("Ping: " + target.getPing() + "ms", NamedTextColor.GRAY));
                lore.add(Component.text("Total VL: " + String.format("%.1f", totalVl), totalVl > 0 ? NamedTextColor.RED : NamedTextColor.YELLOW));
                lore.add(Component.text("Client: " + data.getClientBrand(), NamedTextColor.DARK_AQUA));
                lore.add(Component.empty());

                Map<String, Double> violations = data.getViolations();
                if (!violations.isEmpty()) {
                    lore.add(Component.text("Active Flags:", NamedTextColor.GOLD));
                    violations.forEach((check, vl) -> {
                        if (vl > 0.0) {
                            lore.add(Component.text(" • " + check + ": " + String.format("%.1f", vl), NamedTextColor.RED));
                        }
                    });
                    lore.add(Component.empty());
                }

                lore.add(Component.text("Left-Click to Teleport", NamedTextColor.YELLOW));
                lore.add(Component.text("Right-Click to Reset VL", NamedTextColor.AQUA));
                lore.add(Component.text("Shift-Click to Punish (Kick)", NamedTextColor.DARK_RED));

                meta.lore(lore);
                head.setItemMeta(meta);
            }

            inv.setItem(slot++, head);
        }

        staff.openInventory(inv);
    }

    @EventHandler
    public void onInventoryClick(InventoryClickEvent event) {
        if (!(event.getInventory().getHolder() instanceof NexoraGuiHolder)) {
            return;
        }

        event.setCancelled(true);

        if (!(event.getWhoClicked() instanceof Player staff)) {
            return;
        }

        ItemStack clicked = event.getCurrentItem();
        if (clicked == null || clicked.getType() != Material.PLAYER_HEAD) {
            return;
        }

        SkullMeta meta = (SkullMeta) clicked.getItemMeta();
        if (meta == null || meta.getOwningPlayer() == null) {
            return;
        }

        Player target = meta.getOwningPlayer().getPlayer();
        if (target == null || !target.isOnline()) {
            staff.sendMessage(Component.text("Target player is no longer online.", NamedTextColor.RED));
            staff.closeInventory();
            return;
        }

        PlayerData targetData = plugin.getPlayerDataManager().getData(target);
        if (targetData == null) {
            return;
        }

        if (event.isShiftClick()) {
            staff.closeInventory();
            plugin.getPunishmentManager().executePunishment(target, targetData, "Manual Staff Kick", PunishmentType.KICK, targetData.getTotalViolationLevel());
            staff.sendMessage(Component.text("Executed kick punishment on " + target.getName(), NamedTextColor.GREEN));
        } else if (event.isRightClick()) {
            targetData.resetViolations();
            staff.sendMessage(Component.text("Reset all violations for " + target.getName(), NamedTextColor.GREEN));
            openGui(staff); // Refresh GUI
        } else if (event.isLeftClick()) {
            staff.closeInventory();
            staff.teleport(target.getLocation());
            staff.sendMessage(Component.text("Teleported to " + target.getName(), NamedTextColor.GREEN));
        }
    }
}
