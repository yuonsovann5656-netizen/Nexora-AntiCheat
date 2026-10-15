package com.nexora.anticheat.config;

import com.nexora.anticheat.NexoraPlugin;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.jetbrains.annotations.NotNull;

import java.io.File;
import java.io.IOException;
import java.util.logging.Level;

/**
 * Loads, verifies, and reloads plugin configuration files without requiring a server reboot.
 */
public class ConfigManager {

    private final NexoraPlugin plugin;
    private final Messages messages = new Messages();

    private FileConfiguration config;
    private FileConfiguration messagesConfig;
    private FileConfiguration checksConfig;

    private File configFile;
    private File messagesFile;
    private File checksFile;

    public ConfigManager(@NotNull NexoraPlugin plugin) {
        this.plugin = plugin;
    }

    public void loadAll() {
        if (!plugin.getDataFolder().exists()) {
            plugin.getDataFolder().mkdirs();
        }

        configFile = new File(plugin.getDataFolder(), "config.yml");
        if (!configFile.exists()) {
            plugin.saveResource("config.yml", false);
        }
        config = YamlConfiguration.loadConfiguration(configFile);

        messagesFile = new File(plugin.getDataFolder(), "messages.yml");
        if (!messagesFile.exists()) {
            plugin.saveResource("messages.yml", false);
        }
        messagesConfig = YamlConfiguration.loadConfiguration(messagesFile);
        messages.load(messagesConfig);

        checksFile = new File(plugin.getDataFolder(), "checks.yml");
        if (!checksFile.exists()) {
            plugin.saveResource("checks.yml", false);
        }
        checksConfig = YamlConfiguration.loadConfiguration(checksFile);

        validate();
    }

    private void validate() {
        if (config.getDouble("settings.lag-compensation.min-tps", 18.5) <= 0) {
            plugin.getLogger().warning("Invalid min-tps configured! Resetting to 18.5");
            config.set("settings.lag-compensation.min-tps", 18.5);
        }
    }

    public void reload() {
        loadAll();
    }

    @NotNull
    public FileConfiguration getConfig() {
        return config;
    }

    @NotNull
    public FileConfiguration getMessagesConfig() {
        return messagesConfig;
    }

    @NotNull
    public FileConfiguration getChecksConfig() {
        return checksConfig;
    }

    @NotNull
    public Messages getMessages() {
        return messages;
    }
}
