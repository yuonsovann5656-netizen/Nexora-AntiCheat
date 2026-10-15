package com.nexora.anticheat.check.combat;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.Location;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Entity;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.util.BoundingBox;
import org.bukkit.util.RayTraceResult;
import org.bukkit.util.Vector;
import org.jetbrains.annotations.NotNull;

/**
 * Detects HitBox expansion cheats where players hit entities outside their legitimate bounding box.
 */
public class HitBoxCheck extends Check {

    private double expansionThreshold = 0.25;

    public HitBoxCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "HitBox", "HitBox (Bounding Box Expansion)", CheckCategory.COMBAT);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.expansionThreshold = config.getDouble(path + ".expansion-threshold", 0.25);
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
        Vector eyePos = eyeLoc.toVector();
        Vector direction = eyeLoc.getDirection().normalize();

        BoundingBox box = target.getBoundingBox();

        // Check if ray intersects the standard bounding box
        RayTraceResult hit = box.rayTrace(eyePos, direction, 6.0);
        if (hit == null) {
            // Ray missed the legitimate bounding box; test with expansion threshold
            BoundingBox expandedBox = box.clone().expand(expansionThreshold);
            RayTraceResult expandedHit = expandedBox.rayTrace(eyePos, direction, 6.0);

            if (expandedHit == null) {
                flag(player, data, String.format("Attacked outside entity bounding box (expanded by +%.2f)", expansionThreshold), 1.0);
            }
        }
    }
}
