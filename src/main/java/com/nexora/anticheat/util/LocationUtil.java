package com.nexora.anticheat.util;

import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;

/**
 * Utility methods for inspecting blocks and bounding colliders around player locations.
 */
public final class LocationUtil {

    private LocationUtil() {
        // Utility class
    }

    /**
     * Checks if the block or neighboring blocks immediately beneath/around a location are solid ground.
     *
     * @param location The player location to check.
     * @return True if solid blocks are present near feet level.
     */
    public static boolean isNearGround(Location location) {
        if (location == null || location.getWorld() == null) {
            return false;
        }

        World world = location.getWorld();
        double x = location.getX();
        double y = location.getY();
        double z = location.getZ();

        // Sample bounding box beneath the player (0.3 radius, -0.5 to +0.1 height)
        for (double dx = -0.3; dx <= 0.3; dx += 0.3) {
            for (double dz = -0.3; dz <= 0.3; dz += 0.3) {
                for (double dy = -0.5; dy <= 0.1; dy += 0.3) {
                    Block block = world.getBlockAt(
                            (int) Math.floor(x + dx),
                            (int) Math.floor(y + dy),
                            (int) Math.floor(z + dz)
                    );
                    if (block.getType().isSolid()) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Checks if a location is in or directly adjacent to liquid (water, lava, bubble column).
     *
     * @param location Location to evaluate.
     * @return True if in or near liquid.
     */
    public static boolean isInOrNearLiquid(Location location) {
        if (location == null || location.getWorld() == null) {
            return false;
        }

        World world = location.getWorld();
        int bx = location.getBlockX();
        int by = location.getBlockY();
        int bz = location.getBlockZ();

        for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
                for (int z = -1; z <= 1; z++) {
                    Material mat = world.getBlockAt(bx + x, by + y, bz + z).getType();
                    if (mat == Material.WATER || mat == Material.LAVA || mat == Material.BUBBLE_COLUMN) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Checks if the player is standing on or near ice (regular ice, packed ice, blue ice, frosted ice).
     *
     * @param location Location to test.
     * @return True if near ice.
     */
    public static boolean isNearIce(Location location) {
        if (location == null || location.getWorld() == null) {
            return false;
        }

        World world = location.getWorld();
        int bx = location.getBlockX();
        int by = location.getBlockY();
        int bz = location.getBlockZ();

        for (int x = -1; x <= 1; x++) {
            for (int y = -2; y <= 0; y++) {
                for (int z = -1; z <= 1; z++) {
                    Material mat = world.getBlockAt(bx + x, by + y, bz + z).getType();
                    if (mat == Material.ICE || mat == Material.PACKED_ICE || mat == Material.BLUE_ICE || mat == Material.FROSTED_ICE) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Checks if the player is climbing (ladders, vines, weeping vines, twisting vines, scaffolding).
     *
     * @param location Location to test.
     * @return True if near climbable blocks.
     */
    public static boolean isClimbable(Location location) {
        if (location == null || location.getWorld() == null) {
            return false;
        }

        Block block = location.getBlock();
        Material mat = block.getType();
        return mat == Material.LADDER || mat == Material.VINE || mat == Material.SCAFFOLDING
                || mat == Material.WEEPING_VINES || mat == Material.TWISTING_VINES;
    }

    /**
     * Checks if a location is near slime blocks or honey blocks (bouncing mechanics).
     *
     * @param location Location to test.
     * @return True if near slime or honey.
     */
    public static boolean isNearSlimeOrHoney(Location location) {
        if (location == null || location.getWorld() == null) {
            return false;
        }

        World world = location.getWorld();
        int bx = location.getBlockX();
        int by = location.getBlockY();
        int bz = location.getBlockZ();

        for (int x = -1; x <= 1; x++) {
            for (int y = -2; y <= 0; y++) {
                for (int z = -1; z <= 1; z++) {
                    Material mat = world.getBlockAt(bx + x, by + y, bz + z).getType();
                    if (mat == Material.SLIME_BLOCK || mat == Material.HONEY_BLOCK) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
