package com.nexora.anticheat.gui;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.punishment.PunishmentType;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.ClickType;
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
 * Interactive staff overview GUI displaying live suspicious player metrics,
 * real-time mod client detection (Fabric, Forge, OptiFine, Meteor, Wurst),
 * and one-click quick-action tools.
 */
public class StaffGuiManager implements Listener {

    private final NexoraPlugin plugin;
    private static final Component GUI_TITLE = MiniMessage.miniMessage().deserialize(
            "<#FF0000><bold>Bayon AntiCheat</bold></#FF0000> <dark_gray>»</dark_gray> <gray>Staff Inspection GUI</gray>"
    );

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
                meta.displayName(MiniMessage.miniMessage().deserialize(
                        (totalVl > 0 ? "<red>" : "<green>") + target.getName() + (data.isHackedClient() ? " <dark_red>[CHEAT]</dark_red>" : "")
                ));

                List<Component> lore = new ArrayList<>();

                // Client Mod Detection (Fabric, Forge, OptiFine, Meteor, Wurst)
                lore.add(Component.text("Client: ", NamedTextColor.GRAY).append(formatClientComponent(data)));

                // Network & Combat Telemetry
                int ping = target.getPing();
                String pingColor = ping < 80 ? "<green>" : ping < 160 ? "<yellow>" : "<red>";
                lore.add(MiniMessage.miniMessage().deserialize("<gray>Ping:</gray> " + pingColor + ping + "ms</pingColor>"));
                lore.add(MiniMessage.miniMessage().deserialize(String.format("<gray>CPS:</gray> <aqua>%.1f</aqua>", data.getCps())));
                lore.add(MiniMessage.miniMessage().deserialize(String.format("<gray>Total VL:</gray> %s%.1f</color>", totalVl > 0 ? "<red>" : "<yellow>", totalVl)));

                // PVP Mod Scanner Detection
                if (!data.getDetectedBannedMods().isEmpty()) {
                    lore.add(MiniMessage.miniMessage().deserialize("<dark_red><bold>❌ BANNED PVP MODS:</bold></dark_red>"));
                    for (String mod : data.getDetectedBannedMods()) {
                        lore.add(MiniMessage.miniMessage().deserialize(" <red>• " + mod + "</red>"));
                    }
                } else {
                    lore.add(MiniMessage.miniMessage().deserialize("<gray>PVP Mods:</gray> <green>Clean ✓</green>"));
                }

                if (data.isHackedClient()) {
                    lore.add(Component.empty());
                    lore.add(MiniMessage.miniMessage().deserialize("<dark_red><bold>⚠️ BLACKLISTED CLIENT DETECTED</bold></dark_red>"));
                    lore.add(MiniMessage.miniMessage().deserialize("<red>Identified: <yellow>" + data.getHackedClientName() + "</yellow></red>"));
                }

                lore.add(Component.empty());

                Map<String, Double> violations = data.getViolations();
                if (!violations.isEmpty()) {
                    lore.add(MiniMessage.miniMessage().deserialize("<gold>Active Flags:</gold>"));
                    violations.forEach((check, vl) -> {
                        if (vl > 0.0) {
                            lore.add(MiniMessage.miniMessage().deserialize(String.format(" <dark_gray>•</dark_gray> <yellow>%s</yellow>: <red>%.1f</red>", check, vl)));
                        }
                    });
                    lore.add(Component.empty());
                }

                lore.add(MiniMessage.miniMessage().deserialize("<yellow>[Left-Click]</yellow> <gray>Teleport to player</gray>"));
                lore.add(MiniMessage.miniMessage().deserialize("<aqua>[Right-Click]</aqua> <gray>Reset violation levels</gray>"));
                lore.add(MiniMessage.miniMessage().deserialize("<dark_red>[Shift-Click]</dark_red> <gray>Execute quick kick</gray>"));

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
            staff.sendMessage(MiniMessage.miniMessage().deserialize("<red>Target player is no longer online.</red>"));
            staff.closeInventory();
            return;
        }

        PlayerData targetData = plugin.getPlayerDataManager().getData(target);
        if (targetData == null) {
            return;
        }

        if (event.isShiftClick()) {
            staff.closeInventory();
            plugin.getPunishmentManager().executePunishment(target, targetData, "Staff GUI Kick", PunishmentType.KICK, targetData.getTotalViolationLevel());
            staff.sendMessage(MiniMessage.miniMessage().deserialize("<green>Executed kick on <yellow>" + target.getName() + "</yellow></green>"));
        } else if (event.isRightClick()) {
            targetData.resetViolations();
            staff.sendMessage(MiniMessage.miniMessage().deserialize("<green>Reset violations for <yellow>" + target.getName() + "</yellow></green>"));
            openGui(staff); // Refresh GUI
        } else if (event.isLeftClick()) {
            staff.closeInventory();
            staff.teleport(target.getLocation());
            staff.sendMessage(MiniMessage.miniMessage().deserialize("<green>Teleported to <yellow>" + target.getName() + "</yellow></green>"));
        }
    }

    private Component formatClientComponent(PlayerData data) {
        if (data.isHackedClient()) {
            return MiniMessage.miniMessage().deserialize("<dark_red><bold>⚠️ " + data.getHackedClientName() + " (HACKED)</bold></dark_red>");
        }

        String type = data.getDetailedClientType();
        if (type == null || type.isBlank() || type.equalsIgnoreCase("vanilla")) {
            return MiniMessage.miniMessage().deserialize("<green>Vanilla 1.21.x</green>");
        }

        String lower = type.toLowerCase();
        if (lower.contains("fabric")) {
            return MiniMessage.miniMessage().deserialize("<light_purple>Fabric Client</light_purple>");
        } else if (lower.contains("forge") || lower.contains("fml") || lower.contains("neoforge")) {
            return MiniMessage.miniMessage().deserialize("<gold>Forge / NeoForge</gold>");
        } else if (lower.contains("optifine")) {
            return MiniMessage.miniMessage().deserialize("<aqua>OptiFine HD</aqua>");
        } else if (lower.contains("quilt")) {
            return MiniMessage.miniMessage().deserialize("<dark_purple>Quilt Client</dark_purple>");
        } else if (lower.contains("lunar")) {
            return MiniMessage.miniMessage().deserialize("<blue>Lunar Client</blue>");
        } else if (lower.contains("badlion")) {
            return MiniMessage.miniMessage().deserialize("<yellow>Badlion Client</yellow>");
        } else if (lower.contains("geyser") || lower.contains("bedrock")) {
            return MiniMessage.miniMessage().deserialize("<green>Bedrock (GeyserMC)</green>");
        }

        return MiniMessage.miniMessage().deserialize("<white>" + type + "</white>");
    }
}
