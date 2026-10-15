package com.nexora.anticheat.check.world;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.punishment.PunishmentType;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.block.Block;
import org.bukkit.block.BlockFace;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.BlockBreakEvent;
import org.jetbrains.annotations.NotNull;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Detects and prevents X-Ray / FreeCam / Ore ESP cheats.
 * Rather than abruptly kicking players, this check blocks the suspicious ore from being harvested,
 * either by canceling the break or replacing the ore with surrounding stone.
 */
public class XRayCheck extends Check {

    private boolean blockOre = true;
    private boolean replaceWithStone = true;
    private int minStoneBetweenOres = 12;
    private int maxHiddenOreStreak = 3;

    private static final Set<Material> VALUABLE_ORES = Set.of(
            Material.DIAMOND_ORE,
            Material.DEEPSLATE_DIAMOND_ORE,
            Material.ANCIENT_DEBRIS,
            Material.EMERALD_ORE,
            Material.DEEPSLATE_EMERALD_ORE,
            Material.GOLD_ORE,
            Material.DEEPSLATE_GOLD_ORE,
            Material.NETHER_GOLD_ORE
    );

    private static final Set<Material> FILLER_BLOCKS = Set.of(
            Material.STONE,
            Material.DEEPSLATE,
            Material.NETHERRACK,
            Material.TUFF,
            Material.ANDESITE,
            Material.DIORITE,
            Material.GRANITE,
            Material.BLACKSTONE,
            Material.BASALT
    );

    private static final BlockFace[] ADJACENT_FACES = {
            BlockFace.NORTH, BlockFace.SOUTH, BlockFace.EAST, BlockFace.WEST, BlockFace.UP, BlockFace.DOWN
    };

    // Tracking state per player
    private final Map<UUID, Integer> stoneMinedSinceLastOre = new ConcurrentHashMap<>();
    private final Map<UUID, Integer> hiddenOreStreak = new ConcurrentHashMap<>();

    public XRayCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "XRay", "XRay (Ore ESP / Tunneling)", CheckCategory.WORLD);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.blockOre = config.getBoolean(path + ".block-ore", true);
        this.replaceWithStone = config.getBoolean(path + ".replace-with-stone", true);
        this.minStoneBetweenOres = config.getInt(path + ".min-stone-between-ores", 12);
        this.maxHiddenOreStreak = config.getInt(path + ".max-hidden-ore-streak", 3);
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onBlockBreak(BlockBreakEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        Block block = event.getBlock();
        Material mat = block.getType();
        UUID uuid = player.getUniqueId();

        // Count stone and filler mining
        if (FILLER_BLOCKS.contains(mat)) {
            stoneMinedSinceLastOre.compute(uuid, (k, v) -> v == null ? 1 : v + 1);
            return;
        }

        // Only analyze high-value target ores
        if (!VALUABLE_ORES.contains(mat)) {
            return;
        }

        int stoneCount = stoneMinedSinceLastOre.getOrDefault(uuid, 0);
        boolean isHiddenOre = isOreBuried(block);

        int streak = hiddenOreStreak.getOrDefault(uuid, 0);
        if (isHiddenOre) {
            streak++;
            hiddenOreStreak.put(uuid, streak);
        } else {
            // Ore was naturally exposed to air/cave, reduce suspicion
            hiddenOreStreak.put(uuid, Math.max(0, streak - 1));
        }

        // Suspicious: mining hidden ores in succession without mining standard stone/deepslate tunnels
        if (isHiddenOre && (streak >= maxHiddenOreStreak || stoneCount < minStoneBetweenOres)) {
            String details = String.format("Mined buried %s (Stone mined: %d, Hidden streak: %d)",
                    mat.name().toLowerCase(), stoneCount, streak);

            // Flag violation
            flag(player, data, details, 1.5);

            // Reset counter
            stoneMinedSinceLastOre.put(uuid, 0);

            // Block the ore exploitation without kicking
            if (blockOre) {
                event.setCancelled(true);

                if (replaceWithStone) {
                    Material replacement = mat.name().contains("DEEPSLATE") ? Material.DEEPSLATE
                            : (mat == Material.ANCIENT_DEBRIS || mat == Material.NETHER_GOLD_ORE) ? Material.NETHERRACK
                            : Material.STONE;
                    block.setType(replacement, false);
                }

                // Visual and audio feedback
                player.getWorld().spawnParticle(Particle.SMOKE, block.getLocation().add(0.5, 0.5, 0.5), 8, 0.2, 0.2, 0.2, 0.01);
                player.playSound(block.getLocation(), Sound.BLOCK_FIRE_EXTINGUISH, 0.7F, 1.2F);

                player.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                        "punish.xray-blocked",
                        "<prefix><red>This ore crumbled away as you touched it...</red>",
                        Map.of("player", player.getName(), "ore", mat.name().toLowerCase())
                ));
            }
        } else {
            // Legitimate mining find
            stoneMinedSinceLastOre.put(uuid, 0);
        }
    }

    /**
     * Checks if an ore block is buried inside rock with 0 exposed air/liquid surfaces.
     */
    private boolean isOreBuried(Block block) {
        for (BlockFace face : ADJACENT_FACES) {
            Block relative = block.getRelative(face);
            Material type = relative.getType();
            if (type.isAir() || type == Material.CAVE_AIR || type == Material.VOID_AIR || type == Material.WATER) {
                return false;
            }
        }
        return true;
    }
}
