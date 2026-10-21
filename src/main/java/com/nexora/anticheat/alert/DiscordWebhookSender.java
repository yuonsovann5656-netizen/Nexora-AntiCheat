package com.nexora.anticheat.alert;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.nexora.anticheat.punishment.BanRecord;
import com.nexora.anticheat.util.TaskUtil;
import org.bukkit.plugin.Plugin;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;

/**
 * Asynchronous Discord webhook dispatcher with rich embeds, player avatars, and full punishment details.
 */
public class DiscordWebhookSender {

    private final HttpClient httpClient;

    public DiscordWebhookSender() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    /**
     * Dispatches a rich Discord punishment embed for Kicks and Bans.
     */
    public void sendPunishmentAlertAsync(@NotNull Plugin plugin,
                                         @NotNull String webhookUrl,
                                         @NotNull String playerName,
                                         @NotNull String playerUuid,
                                         @NotNull String action,
                                         @Nullable String durationText,
                                         @NotNull String checkId,
                                         @NotNull String category,
                                         double vl,
                                         @NotNull String details,
                                         int ping,
                                         double tps,
                                         @NotNull String clientBrand,
                                         boolean isCracked,
                                         @Nullable String ipAddress,
                                         boolean showIp,
                                         int embedColor) {
        TaskUtil.runAsync(plugin, () -> {
            try {
                JsonObject embed = new JsonObject();
                boolean isBan = action.equalsIgnoreCase("BAN") || action.toUpperCase().contains("BAN");
                embed.addProperty("title", isBan ? "🚨 Punishment Issued: BANNED" : "⚠️ Punishment Issued: KICKED");
                embed.addProperty("color", embedColor != 0 ? embedColor : (isBan ? 0xFF0000 : 0xFFAA00));
                embed.addProperty("timestamp", Instant.now().toString());

                // Player skin avatar thumbnail
                JsonObject thumbnail = new JsonObject();
                thumbnail.addProperty("url", "https://mc-heads.net/avatar/" + playerName + "/64");
                embed.add("thumbnail", thumbnail);

                JsonArray fields = new JsonArray();

                // Player field
                JsonObject playerField = new JsonObject();
                playerField.addProperty("name", "👤 Player");
                playerField.addProperty("value", "**" + playerName + "**\n`" + playerUuid + "`");
                playerField.addProperty("inline", true);
                fields.add(playerField);

                // Action field
                JsonObject actionField = new JsonObject();
                actionField.addProperty("name", "⚖️ Action");
                String actionVal = "**" + action.toUpperCase() + "**";
                if (durationText != null && !durationText.isBlank()) {
                    actionVal += "\n`Duration: " + durationText + "`";
                }
                actionField.addProperty("value", actionVal);
                actionField.addProperty("inline", true);
                fields.add(actionField);

                // Platform (Cracked vs Premium)
                JsonObject platformField = new JsonObject();
                platformField.addProperty("name", "🌐 Platform");
                platformField.addProperty("value", isCracked ? "🔴 **CRACKED** (Offline UUID)" : "🟢 **PREMIUM** (Mojang Auth)");
                platformField.addProperty("inline", true);
                fields.add(platformField);

                // Check & Category
                JsonObject checkField = new JsonObject();
                checkField.addProperty("name", "🛡️ Detection");
                checkField.addProperty("value", "`" + checkId + "` (" + category + ")\nVL: `" + String.format("%.1f", vl) + "`");
                checkField.addProperty("inline", true);
                fields.add(checkField);

                // Client Brand
                JsonObject brandField = new JsonObject();
                brandField.addProperty("name", "💻 Client Brand");
                brandField.addProperty("value", "`" + (clientBrand.isBlank() ? "Unknown" : clientBrand) + "`");
                brandField.addProperty("inline", true);
                fields.add(brandField);

                // Telemetry (Ping + TPS)
                JsonObject perfField = new JsonObject();
                perfField.addProperty("name", "📊 Performance");
                perfField.addProperty("value", "Ping: `" + ping + "ms`\nTPS: `" + String.format("%.1f", tps) + "`");
                perfField.addProperty("inline", true);
                fields.add(perfField);

                // IP Address (optional)
                if (showIp && ipAddress != null && !ipAddress.isBlank()) {
                    JsonObject ipField = new JsonObject();
                    ipField.addProperty("name", "🔒 IP Address");
                    ipField.addProperty("value", "||`" + ipAddress + "`||");
                    ipField.addProperty("inline", true);
                    fields.add(ipField);
                }

                // Detection Details
                JsonObject detailsField = new JsonObject();
                detailsField.addProperty("name", "📝 Details");
                detailsField.addProperty("value", "```\n" + (details.length() > 900 ? details.substring(0, 900) + "..." : details) + "\n```");
                detailsField.addProperty("inline", false);
                fields.add(detailsField);

                embed.add("fields", fields);

                JsonObject footer = new JsonObject();
                footer.addProperty("text", "Bayon AntiCheat Security Engine • Paper 26.2");
                embed.add("footer", footer);

                JsonArray embeds = new JsonArray();
                embeds.add(embed);

                JsonObject payload = new JsonObject();
                payload.addProperty("username", "Bayon Security");
                payload.addProperty("avatar_url", "https://mc-heads.net/avatar/Bayon/64");
                payload.add("embeds", embeds);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(webhookUrl))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(5))
                        .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                        .build();

                httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            } catch (Exception ignored) {
            }
        });
    }

    /**
     * Backward-compatible alert dispatcher for regular VL alerts.
     */
    public void sendAlertAsync(@NotNull Plugin plugin,
                               @NotNull String webhookUrl,
                               @NotNull String player,
                               @NotNull String check,
                               @NotNull String category,
                               double vl,
                               double maxVl,
                               @NotNull String details,
                               int ping,
                               int embedColor) {
        TaskUtil.runAsync(plugin, () -> {
            try {
                JsonObject embed = new JsonObject();
                embed.addProperty("title", "🚨 AntiCheat Flag: " + check);
                embed.addProperty("color", embedColor != 0 ? embedColor : 0xFF0000);
                embed.addProperty("timestamp", Instant.now().toString());

                JsonObject thumbnail = new JsonObject();
                thumbnail.addProperty("url", "https://mc-heads.net/avatar/" + player + "/64");
                embed.add("thumbnail", thumbnail);

                JsonArray fields = new JsonArray();

                JsonObject playerField = new JsonObject();
                playerField.addProperty("name", "Player");
                playerField.addProperty("value", player);
                playerField.addProperty("inline", true);
                fields.add(playerField);

                JsonObject checkField = new JsonObject();
                checkField.addProperty("name", "Check");
                checkField.addProperty("value", check + " (" + category + ")");
                checkField.addProperty("inline", true);
                fields.add(checkField);

                JsonObject vlField = new JsonObject();
                vlField.addProperty("name", "Violation Level");
                vlField.addProperty("value", String.format("%.1f / %.1f", vl, maxVl));
                vlField.addProperty("inline", true);
                fields.add(vlField);

                JsonObject detailsField = new JsonObject();
                detailsField.addProperty("name", "Details");
                detailsField.addProperty("value", "```\n" + details + "\n```");
                detailsField.addProperty("inline", false);
                fields.add(detailsField);

                JsonObject pingField = new JsonObject();
                pingField.addProperty("name", "Latency");
                pingField.addProperty("value", ping + "ms");
                pingField.addProperty("inline", true);
                fields.add(pingField);

                embed.add("fields", fields);

                JsonArray embeds = new JsonArray();
                embeds.add(embed);

                JsonObject payload = new JsonObject();
                payload.addProperty("username", "Bayon Security");
                payload.add("embeds", embeds);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(webhookUrl))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(5))
                        .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                        .build();

                httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            } catch (Exception ignored) {
            }
        });
    }
}
