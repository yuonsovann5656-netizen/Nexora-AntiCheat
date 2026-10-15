package com.nexora.anticheat.check.movement;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.player.PlayerMoveEvent;
import org.jetbrains.annotations.NotNull;

/**
 * Detects phase, noclip, and door/wall glitching through occluding solid blocks.
 */
public class PhaseCheck extends Check {

    public PhaseCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Phase", "Phase / NoClip", CheckCategory.MOVEMENT);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        if (player.isGliding() || player.isInsideVehicle()) {
            return;
        }

        Location to = event.getTo();
        Block headBlock = to.clone().add(0, 1.2, 0).getBlock();
        Block torsoBlock = to.clone().add(0, 0.6, 0).getBlock();

        // Check if player center is inside a solid full block
        if (isPhaseableSolid(headBlock) && isPhaseableSolid(torsoBlock)) {
            flag(player, data, String.format("Phasing inside solid block: %s at %d,%d,%d",
                    torsoBlock.getType(), torsoBlock.getX(), torsoBlock.getY(), torsoBlock.getZ()), 1.0);
        }
    }

    private boolean isPhaseableSolid(Block block) {
        Material type = block.getType();
        return type.isSolid() && type.isOccluding()
                && !type.name().contains("DOOR")
                && !type.name().contains("FENCE")
                && !type.name().contains("GATE")
                && !type.name().contains("STAIRS")
                && !type.name().contains("SLAB")
                && !type.name().contains("TRAPDOOR")
                && !type.name().contains("BED")
                && !type.name().contains("PISTON");
    }
}
