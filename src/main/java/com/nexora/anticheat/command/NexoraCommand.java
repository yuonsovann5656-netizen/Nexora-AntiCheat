package com.nexora.anticheat.command;

import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.punishment.PunishmentType;
import com.nexora.anticheat.storage.ViolationRecord;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import io.papermc.paper.command.brigadier.Commands;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

import java.util.List;
import java.util.Map;

/**
 * Modern Paper Brigadier command handler for /nxanti and its administration subcommands.
 */
public class NexoraCommand {

    private final NexoraPlugin plugin;

    public NexoraCommand(@NotNull NexoraPlugin plugin) {
        this.plugin = plugin;
    }

    public void register(@NotNull Commands commands) {
        LiteralArgumentBuilder<CommandSourceStack> root = Commands.literal("byac")
                .requires(source -> source.getSender().hasPermission("bayon.command.help")
                        || source.getSender().hasPermission("bayon.admin")
                        || source.getSender().hasPermission("nexora.command.help")
                        || source.getSender().hasPermission("nexora.admin")
                        || source.getSender().isOp())
                .executes(ctx -> {
                    sendHelp(ctx.getSource().getSender());
                    return 1;
                });

        // /byac help
        root.then(Commands.literal("help")
                .requires(source -> source.getSender().hasPermission("bayon.command.help")
                        || source.getSender().hasPermission("bayon.admin")
                        || source.getSender().hasPermission("nexora.command.help")
                        || source.getSender().hasPermission("nexora.admin")
                        || source.getSender().isOp())
                .executes(ctx -> {
                    sendHelp(ctx.getSource().getSender());
                    return 1;
                }));

        // /nxanti reload
        root.then(Commands.literal("reload")
                .requires(source -> source.getSender().hasPermission("nexora.command.reload"))
                .executes(ctx -> {
                    CommandSender sender = ctx.getSource().getSender();
                    long start = System.currentTimeMillis();
                    try {
                        plugin.reloadPlugin();
                        long duration = System.currentTimeMillis() - start;
                        Component msg = plugin.getConfigManager().getMessages().getComponent(
                                "general.reload-success",
                                "<prefix><green>Configuration, checks, and messages reloaded successfully in <yellow><ms>ms</yellow>!</green>",
                                Map.of("ms", String.valueOf(duration))
                        );
                        sender.sendMessage(msg);
                    } catch (Exception ex) {
                        Component msg = plugin.getConfigManager().getMessages().getComponent(
                                "general.reload-failed",
                                "<prefix><red>Failed to reload configuration: <error></red>",
                                Map.of("error", ex.getMessage())
                        );
                        sender.sendMessage(msg);
                    }
                    return 1;
                }));

        // /nxanti alerts [on|off]
        root.then(Commands.literal("alerts")
                .requires(source -> source.getSender().hasPermission("nexora.alerts"))
                .executes(ctx -> {
                    CommandSender sender = ctx.getSource().getSender();
                    if (sender instanceof Player player) {
                        PlayerData data = plugin.getPlayerDataManager().getData(player);
                        if (data != null) {
                            boolean newState = !data.areAlertsEnabled();
                            data.setAlertsEnabled(newState);
                            sendAlertStatus(player, newState);
                        }
                    } else {
                        sender.sendMessage(Component.text("Console always receives violation alerts."));
                    }
                    return 1;
                })
                .then(Commands.argument("state", StringArgumentType.word())
                        .suggests((ctx, builder) -> {
                            builder.suggest("on");
                            builder.suggest("off");
                            return builder.buildFuture();
                        })
                        .executes(ctx -> {
                            CommandSender sender = ctx.getSource().getSender();
                            String state = StringArgumentType.getString(ctx, "state");
                            if (sender instanceof Player player) {
                                PlayerData data = plugin.getPlayerDataManager().getData(player);
                                if (data != null) {
                                    boolean enable = state.equalsIgnoreCase("on");
                                    data.setAlertsEnabled(enable);
                                    sendAlertStatus(player, enable);
                                }
                            }
                            return 1;
                        })));

        // /nxanti info <player>
        root.then(Commands.literal("info")
                .requires(source -> source.getSender().hasPermission("nexora.command.info"))
                .then(Commands.argument("player", StringArgumentType.word())
                        .suggests((ctx, builder) -> {
                            for (Player p : Bukkit.getOnlinePlayers()) {
                                builder.suggest(p.getName());
                            }
                            return builder.buildFuture();
                        })
                        .executes(ctx -> {
                            CommandSender sender = ctx.getSource().getSender();
                            String targetName = StringArgumentType.getString(ctx, "player");
                            Player target = Bukkit.getPlayerExact(targetName);
                            if (target == null) {
                                sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                                        "general.player-not-found",
                                        "<prefix><red>Player <yellow><player></yellow> was not found online.</red>",
                                        Map.of("player", targetName)
                                ));
                                return 0;
                            }
                            sendPlayerInfo(sender, target);
                            return 1;
                        })));

        // /nxanti history <player>
        root.then(Commands.literal("history")
                .requires(source -> source.getSender().hasPermission("nexora.command.history"))
                .then(Commands.argument("player", StringArgumentType.word())
                        .suggests((ctx, builder) -> {
                            // Suggest all online players
                            for (Player p : Bukkit.getOnlinePlayers()) {
                                builder.suggest(p.getName());
                            }
                            // Suggest all recorded offline players from database
                            for (String recordedName : plugin.getStorageManager().getCachedPlayerNames()) {
                                builder.suggest(recordedName);
                            }
                            return builder.buildFuture();
                        })
                        .executes(ctx -> {
                            CommandSender sender = ctx.getSource().getSender();
                            String targetName = StringArgumentType.getString(ctx, "player");
                            sendPlayerHistoryByName(sender, targetName);
                            return 1;
                        })));

        // /nxanti reset <player>
        root.then(Commands.literal("reset")
                .requires(source -> source.getSender().hasPermission("nexora.command.reset"))
                .then(Commands.argument("player", StringArgumentType.word())
                        .suggests((ctx, builder) -> {
                            for (Player p : Bukkit.getOnlinePlayers()) {
                                builder.suggest(p.getName());
                            }
                            return builder.buildFuture();
                        })
                        .executes(ctx -> {
                            CommandSender sender = ctx.getSource().getSender();
                            String targetName = StringArgumentType.getString(ctx, "player");
                            Player target = Bukkit.getPlayerExact(targetName);
                            if (target == null) {
                                sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                                        "general.player-not-found",
                                        "<prefix><red>Player <yellow><player></yellow> was not found online.</red>",
                                        Map.of("player", targetName)
                                ));
                                return 0;
                            }
                            PlayerData data = plugin.getPlayerDataManager().getData(target);
                            if (data != null) {
                                data.resetViolations();
                                sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                                        "reset.success",
                                        "<prefix><green>Successfully reset all violations for <yellow><player></yellow>.</green>",
                                        Map.of("player", target.getName())
                                ));
                            }
                            return 1;
                        })));

        // /nxanti punish <player> <reason>
        root.then(Commands.literal("punish")
                .requires(source -> source.getSender().hasPermission("nexora.command.punish"))
                .then(Commands.argument("player", StringArgumentType.word())
                        .suggests((ctx, builder) -> {
                            for (Player p : Bukkit.getOnlinePlayers()) {
                                builder.suggest(p.getName());
                            }
                            return builder.buildFuture();
                        })
                        .then(Commands.argument("reason", StringArgumentType.greedyString())
                                .executes(ctx -> {
                                    CommandSender sender = ctx.getSource().getSender();
                                    String targetName = StringArgumentType.getString(ctx, "player");
                                    String reason = StringArgumentType.getString(ctx, "reason");
                                    Player target = Bukkit.getPlayerExact(targetName);
                                    if (target == null) {
                                        sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                                                "general.player-not-found",
                                                "<prefix><red>Player <yellow><player></yellow> was not found online.</red>",
                                                Map.of("player", targetName)
                                        ));
                                        return 0;
                                    }
                                    PlayerData data = plugin.getPlayerDataManager().getData(target);
                                    if (data != null) {
                                        plugin.getPunishmentManager().executePunishment(target, data, reason, PunishmentType.KICK, data.getTotalViolationLevel());
                                        sender.sendMessage(Component.text("Executed kick punishment on " + target.getName()));
                                    }
                                    return 1;
                                }))));

        // /nxanti exempt <player> [duration]
        root.then(Commands.literal("exempt")
                .requires(source -> source.getSender().hasPermission("nexora.command.exempt"))
                .then(Commands.argument("player", StringArgumentType.word())
                        .suggests((ctx, builder) -> {
                            for (Player p : Bukkit.getOnlinePlayers()) {
                                builder.suggest(p.getName());
                            }
                            return builder.buildFuture();
                        })
                        .executes(ctx -> {
                            CommandSender sender = ctx.getSource().getSender();
                            String targetName = StringArgumentType.getString(ctx, "player");
                            Player target = Bukkit.getPlayerExact(targetName);
                            if (target == null) {
                                sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                                        "general.player-not-found",
                                        "<prefix><red>Player <yellow><player></yellow> was not found online.</red>",
                                        Map.of("player", targetName)
                                ));
                                return 0;
                            }
                            PlayerData data = plugin.getPlayerDataManager().getData(target);
                            if (data != null) {
                                if (data.isExempt()) {
                                    data.clearExemption();
                                    sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                                            "exempt.removed",
                                            "<prefix><green>Removed exemption for <yellow><player></yellow>.</green>",
                                            Map.of("player", target.getName())
                                    ));
                                } else {
                                    data.setExemption(300_000L); // Default 5 minutes
                                    sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                                            "exempt.success",
                                            "<prefix><green>Player <yellow><player></yellow> is now exempt from checks for <yellow><duration></yellow>.</green>",
                                            Map.of("player", target.getName(), "duration", "5m")
                                    ));
                                }
                            }
                            return 1;
                        })
                        .then(Commands.argument("duration", StringArgumentType.word())
                                .suggests((ctx, builder) -> {
                                    builder.suggest("1m");
                                    builder.suggest("5m");
                                    builder.suggest("15m");
                                    builder.suggest("1h");
                                    return builder.buildFuture();
                                })
                                .executes(ctx -> {
                                    CommandSender sender = ctx.getSource().getSender();
                                    String targetName = StringArgumentType.getString(ctx, "player");
                                    String durStr = StringArgumentType.getString(ctx, "duration");
                                    Player target = Bukkit.getPlayerExact(targetName);
                                    if (target == null) {
                                        sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                                                "general.player-not-found",
                                                "<prefix><red>Player <yellow><player></yellow> was not found online.</red>",
                                                Map.of("player", targetName)
                                        ));
                                        return 0;
                                    }
                                    long ms = parseDuration(durStr);
                                    PlayerData data = plugin.getPlayerDataManager().getData(target);
                                    if (data != null) {
                                        data.setExemption(ms);
                                        sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                                                "exempt.success",
                                                "<prefix><green>Player <yellow><player></yellow> is now exempt from checks for <yellow><duration></yellow>.</green>",
                                                Map.of("player", target.getName(), "duration", durStr)
                                        ));
                                    }
                                    return 1;
                                }))));

        // /nxanti gui
        root.then(Commands.literal("gui")
                .requires(source -> source.getSender().hasPermission("nexora.command.gui")
                        || source.getSender().hasPermission("bayon.admin")
                        || source.getSender().hasPermission("nexora.admin")
                        || source.getSender().isOp())
                .executes(ctx -> {
                    CommandSender sender = ctx.getSource().getSender();
                    if (sender instanceof Player player) {
                        plugin.getStaffGuiManager().openGui(player);
                    } else {
                        sender.sendMessage(Component.text("The GUI can only be opened by players."));
                    }
                    return 1;
                }));

        // /nxanti debug <check>
        root.then(Commands.literal("debug")
                .requires(source -> source.getSender().hasPermission("nexora.command.debug"))
                .then(Commands.argument("check", StringArgumentType.word())
                        .suggests((ctx, builder) -> {
                            for (Check c : plugin.getCheckManager().getAllChecks()) {
                                builder.suggest(c.getId());
                            }
                            return builder.buildFuture();
                        })
                        .executes(ctx -> {
                            CommandSender sender = ctx.getSource().getSender();
                            String checkName = StringArgumentType.getString(ctx, "check");
                            Check check = plugin.getCheckManager().getCheck(checkName);
                            if (check == null) {
                                sender.sendMessage(Component.text("Check not found: " + checkName));
                                return 0;
                            }
                            boolean newState = !check.isDebug();
                            check.setDebug(newState);
                            Component msg = plugin.getConfigManager().getMessages().getComponent(
                                    newState ? "debug.enabled" : "debug.disabled",
                                    newState ? "<prefix><green>Debug mode enabled for check <yellow><check></yellow>.</green>"
                                             : "<prefix><red>Debug mode disabled for check <yellow><check></yellow>.</red>",
                                    Map.of("check", check.getId())
                            );
                            sender.sendMessage(msg);
                            return 1;
                        })));

        // /nxanti unban <player|ip>
        root.then(Commands.literal("unban")
                .requires(source -> source.getSender().hasPermission("nexora.command.unban")
                        || source.getSender().hasPermission("nexora.admin"))
                .then(Commands.argument("target", StringArgumentType.word())
                        .suggests((ctx, builder) -> {
                            for (String name : plugin.getStorageManager().getCachedPlayerNames()) {
                                builder.suggest(name);
                            }
                            return builder.buildFuture();
                        })
                        .executes(ctx -> {
                            CommandSender sender = ctx.getSource().getSender();
                            String target = StringArgumentType.getString(ctx, "target");

                            if (target.contains(".")) {
                                // Assume IP unban
                                plugin.getBanManager().unbanIp(target);
                                sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                                        "punish.unban-ip-success",
                                        "<prefix><green>IP address <yellow><target></yellow> has been unbanned.</green>",
                                        Map.of("target", target)
                                ));
                            } else {
                                // Player name or UUID unban
                                plugin.getBanManager().unbanPlayer(target);
                                sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                                        "punish.unban-success",
                                        "<prefix><green>Player <yellow><target></yellow> has been unbanned and their kick counter reset.</green>",
                                        Map.of("target", target)
                                ));
                            }
                            return 1;
                        })));

        // /nxanti bans <player>
        root.then(Commands.literal("bans")
                .requires(source -> source.getSender().hasPermission("nexora.command.bans")
                        || source.getSender().hasPermission("nexora.admin"))
                .then(Commands.argument("player", StringArgumentType.word())
                        .suggests((ctx, builder) -> {
                            for (Player p : Bukkit.getOnlinePlayers()) {
                                builder.suggest(p.getName());
                            }
                            for (String name : plugin.getStorageManager().getCachedPlayerNames()) {
                                builder.suggest(name);
                            }
                            return builder.buildFuture();
                        })
                        .executes(ctx -> {
                            CommandSender sender = ctx.getSource().getSender();
                            String targetName = StringArgumentType.getString(ctx, "player");
                            sendPlayerBans(sender, targetName);
                            return 1;
                        })));

        // /byac scan <player>
        root.then(Commands.literal("scan")
                .requires(source -> source.getSender().hasPermission("bayon.command.scan")
                        || source.getSender().hasPermission("bayon.admin")
                        || source.getSender().hasPermission("nexora.admin")
                        || source.getSender().isOp())
                .then(Commands.argument("player", StringArgumentType.word())
                        .suggests((ctx, builder) -> {
                            for (Player p : Bukkit.getOnlinePlayers()) {
                                builder.suggest(p.getName());
                            }
                            return builder.buildFuture();
                        })
                        .executes(ctx -> {
                            CommandSender sender = ctx.getSource().getSender();
                            String targetName = StringArgumentType.getString(ctx, "player");
                            Player target = Bukkit.getPlayerExact(targetName);
                            if (target == null) {
                                sender.sendMessage(MiniMessage.miniMessage().deserialize("<#FF0000>[Bayon]</#FF0000> <red>Player not found online: " + targetName + "</red>"));
                                return 0;
                            }
                            sendPlayerScan(sender, target);
                            return 1;
                        })));

        // Register main command /byac with aliases /bayon, /byon, /ac, /bac, /bayonac, /nxanti, /nexora and /nxac
        commands.register(root.build(), "Bayon AntiCheat main administration command", List.of("byac", "bayon", "byon", "ac", "bac", "bayonac", "nxanti", "nexora", "nxac"));
    }

    private void sendPlayerScan(CommandSender sender, Player target) {
        PlayerData data = plugin.getPlayerDataManager().getData(target);
        if (data == null) return;
        MiniMessage mm = MiniMessage.miniMessage();
        sender.sendMessage(mm.deserialize("<#FF0000>━━━━━━━━━━━━━ <bold>Bayon PVP Mod Scanner: " + target.getName() + "</bold> ━━━━━━━━━━━━━</#FF0000>"));
        sender.sendMessage(mm.deserialize("<gray>Client Brand:</gray> <aqua>" + data.getClientBrand() + "</aqua>"));
        sender.sendMessage(mm.deserialize("<gray>Detected Loader / Client:</gray> <yellow>" + data.getDetailedClientType() + "</yellow>"));

        java.util.Set<String> channels = data.getRegisteredChannels();
        sender.sendMessage(mm.deserialize("<gray>Registered Plugin Channels (" + channels.size() + "):</gray>"));
        if (channels.isEmpty()) {
            sender.sendMessage(mm.deserialize("  <dark_gray>•</dark_gray> <gray>Standard Vanilla Handshake</gray>"));
        } else {
            for (String ch : channels) {
                sender.sendMessage(mm.deserialize("  <dark_gray>•</dark_gray> <white>" + ch + "</white>"));
            }
        }

        java.util.Set<String> bannedMods = data.getDetectedBannedMods();
        sender.sendMessage(mm.deserialize("<gray>PVP Mod Status:</gray>"));
        if (!bannedMods.isEmpty()) {
            sender.sendMessage(mm.deserialize("  <dark_red><bold>❌ BANNED PVP MODS DETECTED:</bold></dark_red>"));
            for (String mod : bannedMods) {
                sender.sendMessage(mm.deserialize("    <red>• " + mod + " (Forbidden on this PvP server)</red>"));
            }
        } else {
            sender.sendMessage(mm.deserialize("  <green>✓ All active mods verified clean for PvP.</green>"));
        }
        sender.sendMessage(mm.deserialize("<#FF0000>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</#FF0000>"));
    }

    private void sendHelp(CommandSender sender) {
        MiniMessage mm = MiniMessage.miniMessage();
        sender.sendMessage(mm.deserialize("<#FF0000>━━━━━━━━━━━━━ <bold>Bayon AntiCheat Help</bold> ━━━━━━━━━━━━━</#FF0000>"));
        sender.sendMessage(mm.deserialize(" <red>/byac help</red> <dark_gray>-</dark_gray> <gray>Displays this command overview</gray>"));
        sender.sendMessage(mm.deserialize(" <red>/byac gui</red> <dark_gray>-</dark_gray> <gray>Open interactive staff overview GUI</gray>"));
        sender.sendMessage(mm.deserialize(" <red>/byac scan <player></red> <dark_gray>-</dark_gray> <gray>Scan player for forbidden PvP mods</gray>"));
        sender.sendMessage(mm.deserialize(" <red>/byac reload</red> <dark_gray>-</dark_gray> <gray>Reloads configuration, messages & checks</gray>"));
        sender.sendMessage(mm.deserialize(" <red>/byac alerts [on|off]</red> <dark_gray>-</dark_gray> <gray>Toggles staff violation notifications</gray>"));
        sender.sendMessage(mm.deserialize(" <red>/byac info <player></red> <dark_gray>-</dark_gray> <gray>View player telemetry and violation stats</gray>"));
        sender.sendMessage(mm.deserialize(" <red>/byac history <player></red> <dark_gray>-</dark_gray> <gray>View logged violations history</gray>"));
        sender.sendMessage(mm.deserialize(" <red>/byac reset <player></red> <dark_gray>-</dark_gray> <gray>Clears active violation levels for player</gray>"));
        sender.sendMessage(mm.deserialize(" <red>/byac punish <player> <reason></red> <dark_gray>-</dark_gray> <gray>Manually punish player</gray>"));
        sender.sendMessage(mm.deserialize(" <red>/byac exempt <player> [duration]</red> <dark_gray>-</dark_gray> <gray>Temporarily exempt player</gray>"));
        sender.sendMessage(mm.deserialize(" <red>/byac unban <player|ip></red> <dark_gray>-</dark_gray> <gray>Pardon a banned player or IP address</gray>"));
        sender.sendMessage(mm.deserialize(" <red>/byac bans <player></red> <dark_gray>-</dark_gray> <gray>View ban records and escalation history</gray>"));
        sender.sendMessage(mm.deserialize(" <red>/byac debug <check></red> <dark_gray>-</dark_gray> <gray>Toggle check debugging</gray>"));
        sender.sendMessage(mm.deserialize("<#FF0000>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</#FF0000>"));
    }

    private void sendAlertStatus(Player player, boolean enabled) {
        Component msg = plugin.getConfigManager().getMessages().getComponent(
                enabled ? "alerts.enabled" : "alerts.disabled",
                enabled ? "<prefix><green>Staff violation alerts have been <bold>ENABLED</bold>.</green>"
                        : "<prefix><red>Staff violation alerts have been <bold>DISABLED</bold>.</red>",
                Map.of()
        );
        player.sendMessage(msg);
    }

    private void sendPlayerInfo(CommandSender sender, Player target) {
        PlayerData data = plugin.getPlayerDataManager().getData(target);
        if (data == null) return;

        Map<String, String> placeholders = Map.of(
                "player", target.getName(),
                "uuid", target.getUniqueId().toString(),
                "ping", String.valueOf(target.getPing()),
                "tps", String.format("%.1f", Math.min(20.0, Bukkit.getTPS()[0])),
                "brand", data.getClientBrand(),
                "exempt", data.isExempt() ? "Yes" : "No",
                "total_vl", String.format("%.1f", data.getTotalViolationLevel())
        );

        sender.sendMessage(plugin.getConfigManager().getMessages().getComponent("info.header", "<#FF0000>━━━━━━━━━━━━━━━ <bold>Nexora Player Info</bold> ━━━━━━━━━━━━━━━</#FF0000>", placeholders));
        sender.sendMessage(plugin.getConfigManager().getMessages().getComponent("info.player", "<gray>Player: <yellow><player></yellow> <dark_gray>(<white><uuid></white>)</dark_gray>", placeholders));
        sender.sendMessage(plugin.getConfigManager().getMessages().getComponent("info.ping-tps", "<gray>Ping: <green><ping>ms</green> | Server TPS: <green><tps></green>", placeholders));
        sender.sendMessage(plugin.getConfigManager().getMessages().getComponent("info.client-brand", "<gray>Client Brand: <aqua><brand></aqua>", placeholders));
        sender.sendMessage(plugin.getConfigManager().getMessages().getComponent("info.exempted", "<gray>Exempted: <yellow><exempt></yellow>", placeholders));
        sender.sendMessage(plugin.getConfigManager().getMessages().getComponent("info.total-vl", "<gray>Total Violations: <red><total_vl></red>", placeholders));

        Map<String, Double> violations = data.getViolations();
        if (!violations.isEmpty()) {
            sender.sendMessage(plugin.getConfigManager().getMessages().getComponent("info.active-checks-header", "<gray>Active Check Flags:</gray>", placeholders));
            violations.forEach((checkId, vl) -> {
                if (vl > 0.0) {
                    Check check = plugin.getCheckManager().getCheck(checkId);
                    double maxVl = check != null ? check.getMaxVl() : 10.0;
                    sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                            "info.check-entry",
                            "  <dark_gray>•</dark_gray> <yellow><check></yellow>: <red><vl></red> <dark_gray>/ <gray><max_vl></gray></dark_gray>",
                            Map.of("check", checkId, "vl", String.format("%.1f", vl), "max_vl", String.format("%.1f", maxVl))
                    ));
                }
            });
        }
        sender.sendMessage(plugin.getConfigManager().getMessages().getComponent("info.footer", "<#FF0000>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</#FF0000>", placeholders));
    }

    private void sendPlayerHistoryByName(CommandSender sender, String targetName) {
        plugin.getStorageManager().getHistoryByNameAsync(targetName, 15).thenAccept(records -> {
            boolean isOnline = Bukkit.getPlayerExact(targetName) != null;
            String displayName = isOnline ? targetName : targetName + " <gray>(Offline)</gray>";

            sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                    "history.header",
                    "<#FF0000>━━━━━━━━━━━━━ <bold>Violation History: <player></bold> ━━━━━━━━━━━━━</#FF0000>",
                    Map.of("player", displayName)
            ));

            if (records.isEmpty()) {
                sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                        "history.empty",
                        "<prefix><gray>No violation logs found for <yellow><player></yellow>.</gray>",
                        Map.of("player", targetName)
                ));
            } else {
                for (ViolationRecord record : records) {
                    sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                            "history.entry",
                            "<dark_gray>[<gray><time></gray>]</dark_gray> <yellow><check></yellow> <dark_gray>(<red>VL: <vl></red>)</dark_gray> <gray>- <white><details></white> <dark_gray>(<green><ping>ms</green>)</dark_gray>",
                            Map.of(
                                    "time", record.formattedTime(),
                                    "check", record.checkId(),
                                    "vl", String.format("%.1f", record.vl()),
                                    "details", record.details(),
                                    "ping", String.valueOf(record.ping())
                            )
                    ));
                }
            }
            sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                    "history.footer",
                    "<#FF0000>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</#FF0000>",
                    Map.of()
            ));
        });
    }

    private void sendPlayerBans(CommandSender sender, String targetName) {
        plugin.getStorageManager().getBanHistoryByNameAsync(targetName, 10).thenAccept(records -> {
            sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                    "bans.header",
                    "<#FF0000>━━━━━━━━━━━━━ <bold>Ban History: <player></bold> ━━━━━━━━━━━━━</#FF0000>",
                    Map.of("player", targetName)
            ));

            if (records.isEmpty()) {
                sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                        "bans.empty",
                        "<prefix><gray>No ban records found for <yellow><player></yellow>.</gray>",
                        Map.of("player", targetName)
                ));
            } else {
                for (com.nexora.anticheat.punishment.BanRecord ban : records) {
                    String status = ban.active() ? (ban.isExpired() ? "<yellow>[Expired]</yellow>" : "<red>[Active]</red>") : "<gray>[Pardoned]</gray>";
                    sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                            "bans.entry",
                            "<status> <aqua><duration></aqua> <gray>- Reason: <yellow><reason></yellow> <dark_gray>(Expires: <gold><expires></gold>)</dark_gray></gray>",
                            Map.of(
                                    "status", status,
                                    "duration", ban.tierDescription(),
                                    "reason", ban.reason(),
                                    "expires", ban.formattedExpiresAt()
                            )
                    ));
                }
            }

            sender.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                    "bans.footer",
                    "<#FF0000>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</#FF0000>",
                    Map.of()
            ));
        });
    }

    private long parseDuration(String str) {
        try {
            str = str.toLowerCase();
            if (str.endsWith("s")) {
                return Long.parseLong(str.substring(0, str.length() - 1)) * 1000L;
            } else if (str.endsWith("m")) {
                return Long.parseLong(str.substring(0, str.length() - 1)) * 60_000L;
            } else if (str.endsWith("h")) {
                return Long.parseLong(str.substring(0, str.length() - 1)) * 3600_000L;
            } else if (str.endsWith("d")) {
                return Long.parseLong(str.substring(0, str.length() - 1)) * 86400_000L;
            } else {
                return Long.parseLong(str) * 1000L;
            }
        } catch (Exception e) {
            return 300_000L; // Default 5m
        }
    }
}

