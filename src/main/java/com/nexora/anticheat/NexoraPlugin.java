package com.nexora.anticheat;

import com.nexora.anticheat.alert.AlertManager;
import com.nexora.anticheat.api.NexoraAPI;
import com.nexora.anticheat.check.CheckManager;
import com.nexora.anticheat.command.NexoraCommand;
import com.nexora.anticheat.config.ConfigManager;
import com.nexora.anticheat.data.PlayerManager;
import com.nexora.anticheat.gui.StaffGuiManager;
import com.nexora.anticheat.punishment.PunishmentManager;
import com.nexora.anticheat.storage.StorageManager;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Main entry point for the Nexora AntiCheat plugin on Paper 26.2.
 */
public final class NexoraPlugin extends JavaPlugin {

    private ConfigManager configManager;
    private StorageManager storageManager;
    private PlayerManager playerManager;
    private AlertManager alertManager;
    private PunishmentManager punishmentManager;
    private com.nexora.anticheat.punishment.BanManager banManager;
    private com.nexora.anticheat.license.LicenseManager licenseManager;
    private CheckManager checkManager;
    private StaffGuiManager staffGuiManager;

    @Override
    public void onEnable() {
        long startTime = System.currentTimeMillis();

        // 1. Initialize configuration manager
        this.configManager = new ConfigManager(this);
        this.configManager.loadAll();

        // 1b. License Key Verification (Single-Host & Web Panel Authentication)
        this.licenseManager = new com.nexora.anticheat.license.LicenseManager(this);
        if (!this.licenseManager.verifyLicenseSync()) {
            // License validation failed; plugin self-disabled
            return;
        }

        // 1c. Initialize Bedrock / GeyserMC detection utility
        String bedrockPrefix = this.configManager.getConfig().getString("settings.bedrock.prefix", ".");
        com.nexora.anticheat.util.BedrockUtil.init(bedrockPrefix);

        // 2. Initialize storage manager (SQLite / MySQL)
        this.storageManager = new StorageManager(this);
        this.storageManager.init();

        // 3. Initialize player telemetry & state manager
        this.playerManager = new PlayerManager(this);
        Bukkit.getPluginManager().registerEvents(this.playerManager, this);

        // 4. Initialize alert dispatcher
        this.alertManager = new AlertManager(this);

        // 5. Initialize punishment & progressive ban managers
        this.punishmentManager = new PunishmentManager(this);
        this.banManager = new com.nexora.anticheat.punishment.BanManager(this);
        Bukkit.getPluginManager().registerEvents(this.banManager, this);

        // 6. Initialize staff interactive GUI manager
        this.staffGuiManager = new StaffGuiManager(this);
        Bukkit.getPluginManager().registerEvents(this.staffGuiManager, this);

        // 7. Initialize and register all anti-cheat checks
        this.checkManager = new CheckManager(this);
        this.checkManager.registerAll();

        // 8. Initialize Developer API
        NexoraAPI.init(this);

        // 9. Register modern Paper Brigadier commands via Lifecycle API
        this.getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, event -> {
            new NexoraCommand(this).register(event.registrar());
        });

        long duration = System.currentTimeMillis() - startTime;
        Component enableMsg = MiniMessage.miniMessage().deserialize(
                "<#FF0000><bold>Nexora AntiCheat</bold></#FF0000> <green>v" + getPluginMeta().getVersion()
                        + " enabled successfully in " + duration + "ms on Paper 26.2!</green>"
        );
        Bukkit.getConsoleSender().sendMessage(enableMsg);
    }

    @Override
    public void onDisable() {
        if (this.storageManager != null) {
            this.storageManager.close();
        }

        if (this.playerManager != null) {
            this.playerManager.clearAll();
        }

        Component disableMsg = MiniMessage.miniMessage().deserialize(
                "<#FF0000><bold>Nexora AntiCheat</bold></#FF0000> <gray>has been disabled safely.</gray>"
        );
        Bukkit.getConsoleSender().sendMessage(disableMsg);
    }

    /**
     * Hot-reloads all configurations and check parameters without restarting the server.
     */
    public void reloadPlugin() {
        this.configManager.reload();
        this.checkManager.reload();
    }

    public ConfigManager getConfigManager() {
        return configManager;
    }

    public StorageManager getStorageManager() {
        return storageManager;
    }

    public PlayerManager getPlayerDataManager() {
        return playerManager;
    }

    public AlertManager getAlertManager() {
        return alertManager;
    }

    public PunishmentManager getPunishmentManager() {
        return punishmentManager;
    }

    public com.nexora.anticheat.punishment.BanManager getBanManager() {
        return banManager;
    }

    public com.nexora.anticheat.license.LicenseManager getLicenseManager() {
        return licenseManager;
    }

    public CheckManager getCheckManager() {
        return checkManager;
    }

    public StaffGuiManager getStaffGuiManager() {
        return staffGuiManager;
    }
}
