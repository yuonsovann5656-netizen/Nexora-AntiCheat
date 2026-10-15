package com.nexora.anticheat.check.world;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.FluidCollisionMode;
import org.bukkit.Location;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.util.RayTraceResult;
import org.bukkit.util.Vector;
import org.jetbrains.annotations.NotNull;

/**
 * Detects GhostHand hacks where players interact with or break blocks through solid occluding walls.
 */
public class GhostHandCheck extends Check {

    public GhostHandCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "GhostHand", "GhostHand (Wall Ray-Trace)", CheckCategory.WORLD);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBlockBreak(BlockBreakEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        Block targetBlock = event.getBlock();
        Location eyeLoc = player.getEyeLocation();
        Vector direction = targetBlock.getLocation().add(0.5, 0.5, 0.5).toVector().subtract(eyeLoc.toVector());
        double maxDist = direction.length();

        if (maxDist < 0.2) {
            return;
        }

        direction.normalize();

        // Perform ray trace between eye and block
        RayTraceResult hit = player.getWorld().rayTraceBlocks(
                eyeLoc,
                direction,
                maxDist - 0.2,
                FluidCollisionMode.NEVER,
                true
        );

        if (hit != null && hit.getHitBlock() != null) {
            Block obstruction = hit.getHitBlock();
            if (!obstruction.equals(targetBlock) && obstruction.getType().isOccluding()) {
                flag(player, data, String.format("Mined %s through solid wall %s at %d,%d,%d",
                        targetBlock.getType(), obstruction.getType(), obstruction.getX(), obstruction.getY(), obstruction.getZ()), 1.0);
            }
        }
    }
}
