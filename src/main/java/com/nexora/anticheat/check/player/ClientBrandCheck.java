package com.nexora.anticheat.check.player;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.TaskUtil;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.player.PlayerJoinEvent;
import org.jetbrains.annotations.NotNull;

import java.util.List;

/**
 * Detects blacklisted client brands (e.g. Meteor, Wurst, LiquidBounce, Aristois).
 * Flags the client and routes kicks through the progressive ban escalation system.
 */
public class ClientBrandCheck extends Check {

    private List<String> bannedBrands = List.of("meteor", "wurst", "liquidbounce", "impact", "aristois", "ares");

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

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        // Schedule check 10 ticks after join to allow brand handshake packet to register
        TaskUtil.runEntityLater(plugin, player, () -> {
            if (!player.isOnline()) {
                return;
            }

            String brand = player.getClientBrandName();
            if (brand != null && !brand.isBlank()) {
                data.setClientBrand(brand);
                inspectBrand(player, data, brand);
            }
        }, 10L);
    }

    public void inspectBrand(@NotNull Player player, @NotNull PlayerData data, @NotNull String brand) {
        if (!isEnabled() || shouldSkip(player, data)) {
            return;
        }

        String lowerBrand = brand.toLowerCase();
        for (String banned : bannedBrands) {
            if (lowerBrand.contains(banned.toLowerCase())) {
                flag(player, data, "Unauthorized client brand detected: '" + brand + "' matches blacklist rule '" + banned + "'", getMaxVl());
                break;
            }
        }
    }
}
