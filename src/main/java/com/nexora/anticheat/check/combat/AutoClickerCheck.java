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

        // Feed click telemetry into the Local AI Detection Engine
        if (plugin.getAiDetectionEngine() != null) {
            plugin.getAiDetectionEngine().sample(
                    player.getUniqueId(),
                    cps,
                    0.0,
                    0.0,
                    data.getTotalViolationLevel()
            );
        }

        if (cps > maxCps) {
            // Faster detection: add proportional VL based on how far above max CPS the player clicked
            double excess = cps - maxCps;
            double addedVl = Math.max(1.0, excess * 0.5);
            flag(player, data, String.format("High CPS: %.1f > Max: %.1f", cps, maxCps), addedVl);
            return;
        }

        // Check for unnatural macro consistency (zero variance)
        if (cps >= 12.0) {
            double variance = data.getClickIntervalVariance();
            if (variance < minVariance && variance > 0.0) {
                flag(player, data, String.format("Robotic click consistency: variance=%.2f < min=%.2f (CPS: %.1f)",
                        variance, minVariance, cps), 1.5);
            }
        }
    }
}
