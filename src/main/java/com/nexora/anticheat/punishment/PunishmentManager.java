package com.nexora.anticheat.punishment;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.api.NexoraPunishEvent;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.TaskUtil;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

import java.util.List;
import java.util.Map;

/**
 * Executes setbacks, kicks, bans, and console commands when thresholds are exceeded.
 */
public class PunishmentManager {

    private final NexoraPlugin plugin;

    public PunishmentManager(@NotNull NexoraPlugin plugin) {
        this.plugin = plugin;
    }

    public void executePunishment(@NotNull Player player,
                                  @NotNull PlayerData data,
                                  @NotNull String checkId,
                                  @NotNull PunishmentType type,
                                  double vl) {
        TaskUtil.runEntity(plugin, player, () -> {
            if (!player.isOnline()) {
                return;
            }

            NexoraPunishEvent event = new NexoraPunishEvent(player, checkId, type.name(), "Exceeded threshold for " + checkId);
            Bukkit.getPluginManager().callEvent(event);
            if (event.isCancelled()) {
                return;
            }

            Map<String, String> placeholders = Map.of(
                    "player", player.getName(),
                    "check", checkId,
                    "vl", String.format("%.1f", vl)
            );

            switch (type) {
                case SETBACK -> setback(player, data);
                case WARN -> {
                    Component warnMsg = plugin.getConfigManager().getMessages().getComponent(
                            "punish.warn",
                            "<prefix><red><bold>WARNING:</bold> Unfair advantage detected. Please disable any illegal modifications.</red>",
                            placeholders
                    );
                    player.sendMessage(warnMsg);
                }
                case KICK -> {
                    plugin.getBanManager().processViolationKick(player, data, checkId, vl, "Exceeded threshold for " + checkId);
                }
                case BAN -> {
                    String ip = player.getAddress() != null ? player.getAddress().getAddress().getHostAddress() : null;
                    plugin.getBanManager().executeBanInternal(
                            player.getUniqueId(),
                            player.getName(),
                            ip,
                            "Unfair advantages detected (" + checkId + ")",
                            checkId,
                            "NexoraAC",
                            4,
                            -1L
                    );
                    if (ip != null && plugin.getConfigManager().getConfig().getBoolean("settings.bans.ip-ban-on-permanent", true)) {
                        plugin.getBanManager().executeIpBanInternal(ip, player.getUniqueId(), player.getName(), "Permanent ban (" + checkId + ")", "NexoraAC");
                    }

                    Component banReason = plugin.getConfigManager().getMessages().getComponent(
                            "punish.ban-reason",
                            "<#FF0000><bold>NEXORA ANTICHEAT</bold></#FF0000>\n\n<red>You are permanently banned for cheating (<yellow><check></yellow>).</red>",
                            placeholders
                    );
                    player.kick(banReason);

                    Component broadcast = plugin.getConfigManager().getMessages().getComponent(
                            "punish.ban-broadcast",
                            "<prefix><red><player></red> <gray>was permanently banned by <#FF0000>Nexora</#FF0000> for cheating.</gray>",
                            placeholders
                    );
                    Bukkit.broadcast(broadcast);
                }
                case COMMAND -> {
                    List<String> commands = plugin.getConfigManager().getConfig().getStringList("punishments.commands");
                    for (String cmd : commands) {
                        String parsedCmd = cmd.replace("%player%", player.getName())
                                .replace("%check%", checkId)
                                .replace("%vl%", String.format("%.1f", vl));
                        Bukkit.dispatchCommand(Bukkit.getConsoleSender(), parsedCmd);
                    }
                }
                case BLOCK -> {
                    Component blockMsg = plugin.getConfigManager().getMessages().getComponent(
                            "punish.block",
                            "<prefix><red>Suspicious interaction blocked by <#FF0000>Nexora</#FF0000>.</red>",
                            placeholders
                    );
                    player.sendMessage(blockMsg);
                }
            }
        });
    }

    public void setback(@NotNull Player player, @NotNull PlayerData data) {
        Location safeLoc = data.getLastSafeGroundLocation();
        if (safeLoc != null && safeLoc.getWorld() != null) {
            TaskUtil.runEntity(plugin, player, () -> {
                data.registerTeleport();
                player.teleport(safeLoc);
            });
        }
    }
}
