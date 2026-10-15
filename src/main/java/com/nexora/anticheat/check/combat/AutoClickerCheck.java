package com.nexora.anticheat.check.combat;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.PlayerInteractEvent;
import org.jetbrains.annotations.NotNull;

/**
 * Detects AutoClicker modifications via CPS thresholds and statistical interval variance.
 */
public class AutoClickerCheck extends Check {

    private double maxCps = 20.0;
    private double minVariance = 4.5;

    public AutoClickerCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "AutoClicker", "AutoClicker (CPS / Variance)", CheckCategory.COMBAT);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.maxCps = config.getDouble(path + ".max-cps", 20.0);
        this.minVariance = config.getDouble(path + ".min-variance", 4.5);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onInteract(PlayerInteractEvent event) {
        if (event.getAction() != Action.LEFT_CLICK_AIR && event.getAction() != Action.LEFT_CLICK_BLOCK) {
            return;
        }

        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        data.registerLeftClick();

        double cps = data.getCps();
        if (cps > maxCps) {
            flag(player, data, String.format("High CPS: %.1f > Max: %.1f", cps, maxCps), 1.0);
            return;
        }

        // Check for unnatural macro consistency (zero variance)
        if (cps >= 12.0) {
            double variance = data.getClickIntervalVariance();
            if (variance < minVariance && variance > 0.0) {
                flag(player, data, String.format("Robotic click consistency: variance=%.2f < min=%.2f (CPS: %.1f)",
                        variance, minVariance, cps), 1.0);
            }
        }
    }
}
