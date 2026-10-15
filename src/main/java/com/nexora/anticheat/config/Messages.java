package com.nexora.anticheat.config;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.configuration.file.FileConfiguration;
import org.jetbrains.annotations.NotNull;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Message translation and MiniMessage rendering utility with #FF0000 styling.
 */
public class Messages {

    private final MiniMessage miniMessage = MiniMessage.miniMessage();
    private FileConfiguration messagesConfig;
    private String prefix = "<#FF0000><bold>Nexora</bold></#FF0000> <dark_gray>»</dark_gray> ";

    public void load(@NotNull FileConfiguration config) {
        this.messagesConfig = config;
        this.prefix = config.getString("prefix", "<#FF0000><bold>Nexora</bold></#FF0000> <dark_gray>»</dark_gray> ");
    }

    @NotNull
    public String getRaw(@NotNull String path, @NotNull String def) {
        if (messagesConfig == null) return def;
        return messagesConfig.getString(path, def);
    }

    @NotNull
    public Component getComponent(@NotNull String path, @NotNull String def, Map<String, String> placeholders) {
        String raw = getRaw(path, def);
        raw = raw.replace("<prefix>", prefix);

        List<TagResolver> resolvers = new ArrayList<>();
        if (placeholders != null) {
            for (Map.Entry<String, String> entry : placeholders.entrySet()) {
                resolvers.add(Placeholder.parsed(entry.getKey(), entry.getValue()));
            }
        }

        return miniMessage.deserialize(raw, TagResolver.resolver(resolvers));
    }

    @NotNull
    public Component parse(@NotNull String raw, Map<String, String> placeholders) {
        String formatted = raw.replace("<prefix>", prefix);
        List<TagResolver> resolvers = new ArrayList<>();
        if (placeholders != null) {
            for (Map.Entry<String, String> entry : placeholders.entrySet()) {
                resolvers.add(Placeholder.parsed(entry.getKey(), entry.getValue()));
            }
        }
        return miniMessage.deserialize(formatted, TagResolver.resolver(resolvers));
    }

    @NotNull
    public String getPrefix() {
        return prefix;
    }
}
