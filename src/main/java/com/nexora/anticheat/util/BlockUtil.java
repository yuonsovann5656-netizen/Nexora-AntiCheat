package com.nexora.anticheat.util;

import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;

/**
 * Utility for estimating block breaking speeds and validity based on tool and potion effects.
 */
public final class BlockUtil {

    private BlockUtil() {
        // Utility class
    }

    /**
     * Determines whether a block can be broken instantly (e.g. grass, flowers, torches, redstone wire).
     *
     * @param material Block material to check.
     * @return True if block breaks with 0 mining duration.
     */
    public static boolean isInstaBreak(Material material) {
        if (material == null) return false;
        return material.getHardness() <= 0.05F || material == Material.TORCH
                || material == Material.REDSTONE_WIRE
                || material == Material.TRIPWIRE
                || material.name().contains("FLOWER")
                || material.name().contains("SAPLING")
                || material.name().contains("MUSHROOM")
                || material.name().contains("CARPET");
    }

    /**
     * Computes the approximate minimum breaking duration (in milliseconds) for a player mining a block.
     *
     * @param player The mining player.
     * @param block  The target block.
     * @return The estimated minimum duration in milliseconds.
     */
    public static long getEstimatedBreakDurationMs(Player player, Block block) {
        if (block == null || isInstaBreak(block.getType())) {
            return 0L;
        }

        float hardness = block.getType().getHardness();
        if (hardness < 0) {
            // Unbreakable blocks like bedrock
            return Long.MAX_VALUE;
        }

        double speedMultiplier = 1.0;
        ItemStack tool = player.getInventory().getItemInMainHand();

        // Check tool efficiency
        if (tool != null && tool.getType() != Material.AIR) {
            int effLevel = tool.getEnchantmentLevel(Enchantment.EFFICIENCY);
            if (effLevel > 0) {
                speedMultiplier += (effLevel * effLevel + 1);
            }
        }

        // Haste effect
        PotionEffect haste = player.getPotionEffect(PotionEffectType.HASTE);
        if (haste != null) {
            speedMultiplier *= (1.0 + 0.2 * (haste.getAmplifier() + 1));
        }

        // Mining fatigue effect
        PotionEffect fatigue = player.getPotionEffect(PotionEffectType.MINING_FATIGUE);
        if (fatigue != null) {
            speedMultiplier *= Math.pow(0.3, Math.min(fatigue.getAmplifier() + 1, 4));
        }

        // Base ticks estimation: (hardness * 30) / speedMultiplier
        double estimatedTicks = (hardness * 30.0) / Math.max(0.1, speedMultiplier);
        return Math.max(50L, (long) (estimatedTicks * 50.0));
    }
}
