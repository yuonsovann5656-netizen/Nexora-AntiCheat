package com.nexora.anticheat.check;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.combat.*;
import com.nexora.anticheat.check.movement.*;
import com.nexora.anticheat.check.player.*;
import com.nexora.anticheat.check.world.*;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.TaskUtil;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.FileConfiguration;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registry and orchestrator for all anti-cheat detection modules and violation decays.
 */
public class CheckManager {

    private final NexoraPlugin plugin;
    private final Map<String, Check> checkMap = new ConcurrentHashMap<>();

    public CheckManager(@NotNull NexoraPlugin plugin) {
        this.plugin = plugin;
    }

    public void registerAll() {
        // Movement Checks
        register(new SpeedCheck(plugin));
        register(new FlyCheck(plugin));
        register(new NoFallCheck(plugin));
        register(new JesusCheck(plugin));
        register(new StepCheck(plugin));
        register(new PhaseCheck(plugin));
        register(new TimerCheck(plugin));
        register(new InvalidMovementCheck(plugin));

        // Combat Checks
        register(new KillAuraCheck(plugin));
        register(new ReachCheck(plugin));
        register(new AutoClickerCheck(plugin));
        register(new VelocityCheck(plugin));
        register(new HitBoxCheck(plugin));

        // World Checks
        register(new FastBreakCheck(plugin));
        register(new NukerCheck(plugin));
        register(new ScaffoldCheck(plugin));
        register(new FastPlaceCheck(plugin));
        register(new TowerCheck(plugin));
        register(new GhostHandCheck(plugin));
        register(new XRayCheck(plugin));
        register(new AntiDupeCheck(plugin));

        // Player / Packet Checks
        register(new BadPacketsCheck(plugin));
        register(new InventoryCheck(plugin));
        register(new FastEatCheck(plugin));
        register(new ExploitCheck(plugin));
        register(new ClientBrandCheck(plugin));

        // Register check listeners with Bukkit
        for (Check check : checkMap.values()) {
            Bukkit.getPluginManager().registerEvents(check, plugin);
        }

        // Load configuration values into checks
        reload();

        // Start async repeating VL decay task
        startDecayTask();
    }

    private void register(@NotNull Check check) {
        checkMap.put(check.getId().toLowerCase(), check);
    }

    public void reload() {
        FileConfiguration config = plugin.getConfigManager().getChecksConfig();
        for (Check check : checkMap.values()) {
            check.reloadConfig(config);
        }
    }

    private void startDecayTask() {
        long intervalSeconds = plugin.getConfigManager().getConfig().getLong("settings.vl-decay.interval-seconds", 15L);
        double decayAmount = plugin.getConfigManager().getConfig().getDouble("settings.vl-decay.decay-amount", 1.0);

        TaskUtil.runAsyncTimer(plugin, () -> {
            for (PlayerData data : plugin.getPlayerDataManager().getAllData()) {
                data.decayViolationLevels(decayAmount);
            }
        }, intervalSeconds * 1000L, intervalSeconds * 1000L);
    }

    @Nullable
    public Check getCheck(@NotNull String id) {
        return checkMap.get(id.toLowerCase());
    }

    @NotNull
    public Collection<Check> getAllChecks() {
        return Collections.unmodifiableCollection(checkMap.values());
    }

    public void unregisterAll() {
        for (Check check : checkMap.values()) {
            org.bukkit.event.HandlerList.unregisterAll(check);
        }
        checkMap.clear();
    }
}
