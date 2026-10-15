package com.nexora.anticheat.license;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.util.TaskUtil;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.FileConfiguration;
import org.jetbrains.annotations.NotNull;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Validates the server's license key against the remote Nexora Web Panel Licensing Authority.
 * Disables the plugin if the key is invalid, revoked, banned, or bound to another host.
 */
public class LicenseManager {

    private final NexoraPlugin plugin;
    private final HttpClient httpClient;

    private boolean verified = false;
    private String licensedOwner = "Unknown";
    private String licenseTier = "Unknown";

    public LicenseManager(@NotNull NexoraPlugin plugin) {
        this.plugin = plugin;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(4))
                .build();
    }

    /**
     * Synchronously validates the license on server startup.
     *
     * @return True if license is valid; false if invalid or banned.
     */
    public boolean verifyLicenseSync() {
        FileConfiguration config = plugin.getConfigManager().getConfig();
        boolean enabled = config.getBoolean("license.enabled", true);
        if (!enabled) {
            this.verified = true;
            return true;
        }

        String key = config.getString("license.key", "NX-DEMO-2026-KEY1");
        String apiUrl = config.getString("license.api-url", "http://localhost:3000/api");
        String serverName = config.getString("license.server-name", "Minecraft Server");

        MiniMessage mm = MiniMessage.miniMessage();

        try {
            JsonObject payload = new JsonObject();
            payload.addProperty("key", key);
            payload.addProperty("serverName", serverName);
            payload.addProperty("port", Bukkit.getPort());
            payload.addProperty("mcVersion", Bukkit.getVersion());
            payload.addProperty("pluginVersion", plugin.getPluginMeta().getVersion());

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl + "/license/verify"))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(5))
                    .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();

            boolean valid = json.has("valid") && json.get("valid").getAsBoolean();

            if (valid) {
                this.verified = true;
                this.licensedOwner = json.has("owner") ? json.get("owner").getAsString() : "Verified Customer";
                this.licenseTier = json.has("tier") ? json.get("tier").getAsString() : "LIFETIME";

                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        "<#FF0000>━━━━━━━━━━━━━ <bold>Nexora License Verified</bold> ━━━━━━━━━━━━━</#FF0000>"
                ));
                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        " <green>✓ License Status: <bold>VALID & ACTIVE</bold></green>"
                ));
                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        " <gray>Licensed To: <yellow>" + licensedOwner + "</yellow> | Tier: <aqua>" + licenseTier + "</aqua></gray>"
                ));
                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        " <gray>Key: <white>" + key + "</white></gray>"
                ));
                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        "<#FF0000>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</#FF0000>"
                ));

                // Start periodic telemetry heartbeat
                startHeartbeatTask();
                return true;
            } else {
                String reason = json.has("reason") ? json.get("reason").getAsString() : "UNKNOWN_ERROR";
                String message = json.has("message") ? json.get("message").getAsString() : "Verification rejected.";

                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        "<#FF0000>━━━━━━━━━━━━━ <bold>NEXORA LICENSE ERROR</bold> ━━━━━━━━━━━━━</#FF0000>"
                ));
                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        " <red>✘ License Verification FAILED: <bold>" + reason + "</bold></red>"
                ));
                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        " <yellow>Details: " + message + "</yellow>"
                ));
                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        " <red>Nexora AntiCheat will now disable itself to protect integrity.</red>"
                ));
                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        "<#FF0000>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</#FF0000>"
                ));

                Bukkit.getPluginManager().disablePlugin(plugin);
                return false;
            }
        } catch (Exception ex) {
            boolean allowOfflineGrace = config.getBoolean("license.allow-offline-grace", true);
            if (allowOfflineGrace) {
                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        "<yellow>[Nexora Licensing] Panel API unreachable (" + ex.getMessage() + "). Running in offline grace mode.</yellow>"
                ));
                this.verified = true;
                return true;
            } else {
                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        "<#FF0000>[Nexora Licensing] Failed to reach licensing server. Disabling plugin.</#FF0000>"
                ));
                Bukkit.getPluginManager().disablePlugin(plugin);
                return false;
            }
        }
    }

    /**
     * Schedules periodic heartbeat pings to the Web Panel every 60-120 seconds.
     * If the license key is banned or suspended remotely, shuts down the plugin.
     */
    private void startHeartbeatTask() {
        FileConfiguration config = plugin.getConfigManager().getConfig();
        long intervalSec = config.getLong("license.heartbeat-interval-seconds", 60L);
        String key = config.getString("license.key", "NX-DEMO-2026-KEY1");
        String apiUrl = config.getString("license.api-url", "http://localhost:3000/api");
        String serverName = config.getString("license.server-name", "Minecraft Server");

        TaskUtil.runAsyncTimer(plugin, () -> {
            try {
                JsonObject payload = new JsonObject();
                payload.addProperty("key", key);
                payload.addProperty("serverName", serverName);
                payload.addProperty("onlinePlayers", Bukkit.getOnlinePlayers().size());
                payload.addProperty("tps", Bukkit.getTPS()[0]);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(apiUrl + "/license/heartbeat"))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(4))
                        .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();

                boolean valid = json.has("valid") && json.get("valid").getAsBoolean();
                if (!valid) {
                    String reason = json.has("reason") ? json.get("reason").getAsString() : "BANNED";
                    MiniMessage mm = MiniMessage.miniMessage();
                    Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                            "<#FF0000><bold>[Nexora Security] Remote revocation received: " + reason + "! Disabling plugin...</bold></#FF0000>"
                    ));
                    Bukkit.getScheduler().runTask(plugin, () -> Bukkit.getPluginManager().disablePlugin(plugin));
                }
            } catch (Exception ignored) {
                // Network hiccup - ignore single failed heartbeat
            }
        }, intervalSec * 1000L, intervalSec * 1000L);
    }

    public boolean isVerified() {
        return verified;
    }

    public String getLicensedOwner() {
        return licensedOwner;
    }

    public String getLicenseTier() {
        return licenseTier;
    }
}
