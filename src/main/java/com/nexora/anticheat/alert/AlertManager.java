package com.nexora.anticheat.alert;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.data.PlayerData;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.event.HoverEvent;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Dispatches rich interactive staff alerts in-game and to external webhooks.
 */
public class AlertManager {

    private final NexoraPlugin plugin;
    private final DiscordWebhookSender discordSender = new DiscordWebhookSender();
    private final Map<String, Long> alertCooldowns = new ConcurrentHashMap<>();

    public AlertManager(@NotNull NexoraPlugin plugin) {
        this.plugin = plugin;
    }

    public void sendAlert(@NotNull Player player,
                          @NotNull String checkId,
                          @NotNull String category,
                          double vl,
                          double maxVl,
                          @NotNull String details) {
        FileConfiguration config = plugin.getConfigManager().getConfig();
        if (!config.getBoolean("alerts.enabled", true)) {
            return;
        }

        // Rate-limit alert spam per player & check
        String cooldownKey = player.getUniqueId() + ":" + checkId.toLowerCase();
        long now = System.currentTimeMillis();
        long cooldownMs = config.getLong("alerts.cooldown-ms", 1000L);
        Long lastAlert = alertCooldowns.get(cooldownKey);
        if (lastAlert != null && now - lastAlert < cooldownMs) {
            return;
        }
        alertCooldowns.put(cooldownKey, now);

        int ping = player.getPing();
        double tps = Math.min(20.0, Math.round(Bukkit.getTPS()[0] * 10.0) / 10.0);

        // Build MiniMessage placeholders
        Map<String, String> placeholders = Map.of(
                "player", player.getName(),
                "check", checkId,
                "category", category,
                "vl", String.format("%.1f", vl),
                "max_vl", String.format("%.1f", maxVl),
                "details", details,
                "ping", String.valueOf(ping),
                "tps", String.valueOf(tps)
        );

        Component baseAlert = plugin.getConfigManager().getMessages().getComponent(
                "alerts.format",
                "<prefix><red><player></red> <gray>failed</gray> <yellow><check></yellow> <dark_gray>(<gray>VL: <red><vl></red>/<gold><max_vl></gold></gray>)</dark_gray>",
                placeholders
        );

        Component hoverComponent = plugin.getConfigManager().getMessages().getComponent(
                "alerts.hover",
                "<gray>Check: <yellow><check></yellow>\nCategory: <aqua><category></aqua>\nDetails: <white><details></white>\nPing: <green><ping>ms</green> | TPS: <green><tps></green>\n<yellow>Click to teleport to player!</yellow></gray>",
                placeholders
        );

        // Interactive hover and click-to-teleport component
        Component fullAlert = baseAlert
                .hoverEvent(HoverEvent.showText(hoverComponent))
                .clickEvent(ClickEvent.runCommand("/tp " + player.getName()));

        String permission = config.getString("alerts.permission", "nexora.alerts");

        // Broadcast to permitted online staff members
        for (Player onlineStaff : Bukkit.getOnlinePlayers()) {
            if (onlineStaff.hasPermission(permission)) {
                PlayerData staffData = plugin.getPlayerDataManager().getData(onlineStaff);
                if (staffData == null || staffData.areAlertsEnabled()) {
                    onlineStaff.sendMessage(fullAlert);
                }
            }
        }

        // Console alert
        Bukkit.getConsoleSender().sendMessage(baseAlert);

        // Discord Webhook integration (if not restricted to punishments only)
        if (config.getBoolean("alerts.discord.enabled", false)
                && !config.getBoolean("alerts.discord.only-on-punishment", true)) {
            String webhookUrl = config.getString("alerts.discord.webhook-url", "");
            if (webhookUrl != null && !webhookUrl.isBlank() && !webhookUrl.contains("YOUR_WEBHOOK_URL_HERE")) {
                int embedColor = config.getInt("alerts.discord.embed-color", 16711680);
                discordSender.sendAlertAsync(
                        plugin,
                        webhookUrl,
                        player.getName(),
                        checkId,
                        category,
                        vl,
                        maxVl,
                        details,
                        ping,
                        embedColor
                );
            }
        }
    }

    public DiscordWebhookSender getDiscordSender() {
        return discordSender;
    }
}
