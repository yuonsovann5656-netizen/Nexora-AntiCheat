package com.nexora.anticheat.check.combat;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.MathUtil;
import com.nexora.anticheat.util.RayTraceUtil;
import org.bukkit.Location;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Entity;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.jetbrains.annotations.NotNull;

import java.util.UUID;

/**
 * Detects KillAura through rotation snapping, impossible attack angles, and multi-target switching.
 */
public class KillAuraCheck extends Check {

    private double maxYawSpeed = 120.0;
    private long multiTargetWindowMs = 100L;

    public KillAuraCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "KillAura", "KillAura (Angle / MultiTarget)", CheckCategory.COMBAT);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.maxYawSpeed = config.getDouble(path + ".max-yaw-speed", 120.0);
        this.multiTargetWindowMs = config.getLong(path + ".multi-target-window-ms", 100L);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onAttack(EntityDamageByEntityEvent event) {
        if (!(event.getDamager() instanceof Player player) || !(event.getEntity() instanceof LivingEntity target)) {
            return;
        }

        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        Location eyeLoc = player.getEyeLocation();
        Location targetLoc = target.getLocation().add(0, target.getHeight() / 2.0, 0);

        // 1. Check line-of-sight angle offset
        double angleOffset = RayTraceUtil.getAngleOffset(eyeLoc, targetLoc);
        if (angleOffset > 75.0) {
            double excess = angleOffset - 75.0;
            double addedVl = Math.max(1.0, excess * 0.1);
            flag(player, data, String.format("Attacked outside field of view: angle=%.1f° > 75°", angleOffset), addedVl);
            return;
        }

        // 2. Check multi-target aura
        long now = System.currentTimeMillis();
        UUID lastTarget = data.getLastTargetId();
        if (lastTarget != null && !lastTarget.equals(target.getUniqueId())) {
            long diff = now - data.getLastAttackTimestamp();
            if (diff < multiTargetWindowMs) {
                flag(player, data, String.format("Rapid target switch within %dms to different entity", diff), 2.0);
            }
        }

        // Register attack
        data.registerAttack(target.getUniqueId());
    }
}
