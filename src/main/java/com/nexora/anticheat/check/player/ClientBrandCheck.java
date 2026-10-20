package com.nexora.anticheat.check.player;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.BedrockUtil;
import com.nexora.anticheat.util.TaskUtil;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerRegisterChannelEvent;
import org.jetbrains.annotations.NotNull;

import java.util.List;
import java.util.Set;

/**
 * Detects blacklisted client brands and hacked plugin message channels (e.g. Meteor, Wurst, LiquidBounce).
 * Also categorizes legitimate client mod loaders (Fabric, Forge, OptiFine, Quilt, Lunar, Badlion, Bedrock).
 */
public class ClientBrandCheck extends Check {

    private List<String> bannedBrands = List.of(
            "meteor", "wurst", "liquidbounce", "impact", "aristois", "ares", "sigma", "future", "bleachhack", "jex"
    );

    private static final Set<String> METEOR_CHANNELS = Set.of(
            "meteor-client:teleport", "meteor-client:c2s", "meteor:main", "meteor:c2s",
            "meteor:capes", "meteor:meteor", "meteor-client", "meteor"
    );

    private static final Set<String> WURST_CHANNELS = Set.of(
            "wurst:wurst", "wurst:main", "wurst:c2s", "wurst", "wurstclient"
    );

    private static final Set<String> HACKED_CHANNELS = Set.of(
            "baritone:channel", "baritone", "cml:main", "liquidbounce:main", "liquidbounce",
            "aristois:main", "aristois", "impact:main", "impact", "bleachhack:main"
    );

    public ClientBrandCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "ClientBrand", "ClientBrand (Blacklisted Client)", CheckCategory.PLAYER);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        List<String> list = plugin.getConfigManager().getConfig().getStringList("settings.banned-clients.brands");
        if (list != null && !list.isEmpty()) {
            this.bannedBrands = list;
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onChannelRegister(PlayerRegisterChannelEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null) {
            return;
        }

        String channel = event.getChannel().toLowerCase();
        data.addRegisteredChannel(channel);

        // 1. Detect Meteor Client via registered channels
        if (METEOR_CHANNELS.contains(channel) || channel.startsWith("meteor-client") || channel.startsWith("meteor:")) {
            data.setHackedClient(true);
            data.setHackedClientName("Meteor Client");
            data.setDetailedClientType("⚠️ Meteor Client (HACKED)");
            flag(player, data, "Meteor Client channel handshake intercepted: '" + channel + "'", getMaxVl());
            return;
        }

        // 2. Detect Wurst Client via registered channels
        if (WURST_CHANNELS.contains(channel) || channel.startsWith("wurst:") || channel.equals("wurst")) {
            data.setHackedClient(true);
            data.setHackedClientName("Wurst Client");
            data.setDetailedClientType("⚠️ Wurst Client (HACKED)");
            flag(player, data, "Wurst Client channel handshake intercepted: '" + channel + "'", getMaxVl());
            return;
        }

        // 3. Detect other hacked client channels
        if (HACKED_CHANNELS.contains(channel)) {
            data.setHackedClient(true);
            data.setHackedClientName("Hacked Mod (" + channel + ")");
            data.setDetailedClientType("⚠️ " + channel + " (HACKED)");
            flag(player, data, "Blacklisted cheat channel intercepted: '" + channel + "'", getMaxVl());
            return;
        }

        // 4. Identify legitimate client mod loaders
        if (channel.contains("optifine")) {
            if (!data.isHackedClient()) data.setDetailedClientType("OptiFine HD");
        } else if (channel.contains("fml") || channel.contains("forge") || channel.contains("neoforge")) {
            if (!data.isHackedClient()) data.setDetailedClientType("Forge / NeoForge");
        } else if (channel.contains("fabric")) {
            if (!data.isHackedClient() && data.getDetailedClientType().equals("Vanilla")) {
                data.setDetailedClientType("Fabric Client");
            }
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        // Schedule inspection 10 ticks after join to allow brand and channels to populate
        TaskUtil.runEntityLater(plugin, player, () -> {
            if (!player.isOnline()) {
                return;
            }

            // Check if player is Bedrock edition
            if (BedrockUtil.isBedrock(player)) {
                data.setClientBrand("geyser");
                data.setDetailedClientType("Bedrock (GeyserMC)");
                return;
            }

            String brand = player.getClientBrandName();
            if (brand != null && !brand.isBlank()) {
                data.setClientBrand(brand);
                inspectBrand(player, data, brand);
            }

            // Inspect currently listening plugin channels
            for (String ch : player.getListeningPluginChannels()) {
                data.addRegisteredChannel(ch);
                String lowerCh = ch.toLowerCase();
                if (METEOR_CHANNELS.contains(lowerCh) || lowerCh.contains("meteor")) {
                    data.setHackedClient(true);
                    data.setHackedClientName("Meteor Client");
                    data.setDetailedClientType("⚠️ Meteor Client (HACKED)");
                    flag(player, data, "Meteor Client active channel: " + ch, getMaxVl());
                    break;
                } else if (WURST_CHANNELS.contains(lowerCh) || lowerCh.contains("wurst")) {
                    data.setHackedClient(true);
                    data.setHackedClientName("Wurst Client");
                    data.setDetailedClientType("⚠️ Wurst Client (HACKED)");
                    flag(player, data, "Wurst Client active channel: " + ch, getMaxVl());
                    break;
                }
            }
        }, 10L);
    }

    public void inspectBrand(@NotNull Player player, @NotNull PlayerData data, @NotNull String brand) {
        if (!isEnabled() || shouldSkip(player, data)) {
            return;
        }

        String lowerBrand = brand.toLowerCase();

        // Check blacklist
        for (String banned : bannedBrands) {
            if (lowerBrand.contains(banned.toLowerCase())) {
                data.setHackedClient(true);
                data.setHackedClientName(brand);
                data.setDetailedClientType("⚠️ " + brand + " (HACKED)");
                flag(player, data, "Unauthorized client brand detected: '" + brand + "' matches blacklist rule '" + banned + "'", getMaxVl());
                return;
            }
        }

        // Legitimate client categorization
        if (data.isHackedClient()) {
            return;
        }

        if (lowerBrand.contains("optifine")) {
            data.setDetailedClientType("OptiFine HD");
        } else if (lowerBrand.contains("lunar")) {
            data.setDetailedClientType("Lunar Client");
        } else if (lowerBrand.contains("badlion")) {
            data.setDetailedClientType("Badlion Client");
        } else if (lowerBrand.contains("feather")) {
            data.setDetailedClientType("Feather Client");
        } else if (lowerBrand.contains("fabric")) {
            data.setDetailedClientType("Fabric Client");
        } else if (lowerBrand.contains("forge") || lowerBrand.contains("fml") || lowerBrand.contains("neoforge")) {
            data.setDetailedClientType("Forge / NeoForge");
        } else if (lowerBrand.contains("quilt")) {
            data.setDetailedClientType("Quilt Client");
        } else if (lowerBrand.equals("vanilla")) {
            data.setDetailedClientType("Vanilla 1.21.x");
        } else {
            data.setDetailedClientType(brand);
        }
    }
}
