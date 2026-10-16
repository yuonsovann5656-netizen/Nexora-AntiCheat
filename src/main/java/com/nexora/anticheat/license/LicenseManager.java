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
 * Connects the Minecraft server to the remote Nexora Web Panel.
 * Runs completely free without requiring a license key.
 */
public class LicenseManager {

    private final NexoraPlugin plugin;
    private final HttpClient httpClient;

    private boolean verified = true;
    private String serverId = "srv_default";

    public LicenseManager(@NotNull NexoraPlugin plugin) {
        this.plugin = plugin;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(4))
                .build();
    }

    /**
     * Initializes connection to the Nexora Web Panel if configured.
     * Always allows the plugin to load (never disables itself).
     *
     * @return true always, enabling free execution.
     */
    public boolean verifyLicenseSync() {
        FileConfiguration config = plugin.getConfigManager().getConfig();
        boolean enabled = config.getBoolean("panel.enabled", config.getBoolean("license.enabled", true));
        String apiUrl = config.getString("panel.api-url", config.getString("license.api-url", "http://localhost:3000/api"));
        String serverName = config.getString("panel.server-name", config.getString("license.server-name", "Minecraft Server"));

        MiniMessage mm = MiniMessage.miniMessage();

        Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                "<#FF0000>━━━━━━━━━━━━━ <bold>Nexora AntiCheat v" + plugin.getPluginMeta().getVersion() + "</bold> ━━━━━━━━━━━━━</#FF0000>"
        ));
        Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                " <green>✓ AntiCheat Engine: <bold>ACTIVE & RUNNING</bold></green>"
        ));
        Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                " <gray>Mode: <green>Free Community Edition (No License Required)</green></gray>"
        ));

        if (!enabled || apiUrl == null || apiUrl.isBlank()) {
            Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                    " <gray>Cloud Fleet: <yellow>Standalone Mode (Offline)</yellow></gray>"
            ));
            Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                    "<#FF0000>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</#FF0000>"
            ));
            return true;
        }

        try {
            JsonObject payload = new JsonObject();
            payload.addProperty("serverName", serverName);
            payload.addProperty("port", Bukkit.getPort());
            payload.addProperty("mcVersion", Bukkit.getVersion());
            payload.addProperty("pluginVersion", plugin.getPluginMeta().getVersion());

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl.replaceAll("/+$", "") + "/license/verify"))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(4))
                    .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
                if (json.has("serverId")) {
                    this.serverId = json.get("serverId").getAsString();
                }
                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        " <green>✓ Cloud Fleet Connected: <white>" + apiUrl + "</white></green>"
                ));
            } else {
                Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                        " <gray>Cloud Fleet: <yellow>Connected in local fallback mode</yellow></gray>"
                ));
            }
        } catch (Exception ex) {
            Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                    " <gray>Cloud Fleet: <yellow>Running standalone (" + ex.getMessage() + ")</yellow></gray>"
            ));
        }

        Bukkit.getConsoleSender().sendMessage(mm.deserialize(
                "<#FF0000>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</#FF0000>"
        ));

        // Start heartbeat to report online players & TPS to web panel
        startHeartbeatTask();
        return true;
    }

    /**
     * Schedules periodic heartbeat pings to the Web Panel every 60 seconds.
     */
    private void startHeartbeatTask() {
        FileConfiguration config = plugin.getConfigManager().getConfig();
        long intervalSec = config.getLong("panel.heartbeat-interval-seconds",
                config.getLong("license.heartbeat-interval-seconds", 60L));
        String apiUrl = config.getString("panel.api-url",
                config.getString("license.api-url", "http://localhost:3000/api"));
        String serverName = config.getString("panel.server-name",
                config.getString("license.server-name", "Minecraft Server"));

        if (apiUrl == null || apiUrl.isBlank()) return;

        TaskUtil.runAsyncTimer(plugin, () -> {
            try {
                JsonObject payload = new JsonObject();
                payload.addProperty("serverId", serverId);
                payload.addProperty("serverName", serverName);
                payload.addProperty("onlinePlayers", Bukkit.getOnlinePlayers().size());
                payload.addProperty("tps", Bukkit.getTPS()[0]);

                // Collect list of online player names
                com.google.gson.JsonArray playerArray = new com.google.gson.JsonArray();
                for (org.bukkit.entity.Player p : Bukkit.getOnlinePlayers()) {
                    playerArray.add(p.getName());
                }
                payload.add("playerNames", playerArray);

                // Collect installed plugins
                com.google.gson.JsonArray pluginArray = new com.google.gson.JsonArray();
                for (org.bukkit.plugin.Plugin pl : Bukkit.getPluginManager().getPlugins()) {
                    JsonObject pObj = new JsonObject();
                    pObj.addProperty("name", pl.getName());
                    pObj.addProperty("version", pl.getPluginMeta().getVersion());
                    pluginArray.add(pObj);
                }
                payload.add("plugins", pluginArray);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(apiUrl.replaceAll("/+$", "") + "/license/heartbeat"))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(4))
                        .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                        .build();

                httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            } catch (Exception ignored) {
                // Ignore network hiccup
            }
        }, intervalSec * 1000L, intervalSec * 1000L);
    }

    public boolean isVerified() {
        return verified;
    }

    public String getLicensedOwner() {
        return "Community Edition";
    }

    public String getLicenseTier() {
        return "FREE";
    }
}
