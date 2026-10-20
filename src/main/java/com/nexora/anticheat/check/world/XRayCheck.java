package com.nexora.anticheat.check.world;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
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
 * Detects and actively blocks X-Ray, FreeCam, and Ore ESP cheats.
 *
 * <p>Uses face density analysis: buried ores surrounded by 4 or more solid stone/deepslate
 * faces are identified even after a player breaks the single block touching them.
 * When suspicious X-Ray mining is detected, the ore block break is canceled, dropped items
 * are blocked, and the block is reverted to surrounding stone/deepslate.
 */
public class XRayCheck extends Check {

    private boolean blockOre = true;
    private boolean replaceWithStone = true;
    private int minStoneBetweenOres = 8;
    private int maxHiddenOreStreak = 2;

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
            Material.BASALT,
            Material.DIRT,
            Material.GRAVEL
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
        this.minStoneBetweenOres = config.getInt(path + ".min-stone-between-ores", 8);
        this.maxHiddenOreStreak = config.getInt(path + ".max-hidden-ore-streak", 2);
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

        // Count stone/filler mining progress
        if (FILLER_BLOCKS.contains(mat)) {
            stoneMinedSinceLastOre.compute(uuid, (k, v) -> (v == null ? 0 : v) + 1);
            data.incrementStoneMined();
            return;
        }

        // Only monitor valuable targeted ores
        if (!VALUABLE_ORES.contains(mat)) {
            return;
        }

        int solidFaces = countSolidSurroundingFaces(block);
        // An ore with 4 or more solid faces is buried in rock (even if 1 face was just dug by player)
        boolean isBuriedOre = solidFaces >= 4;

        int stoneCount = stoneMinedSinceLastOre.getOrDefault(uuid, 0);
        int streak = hiddenOreStreak.getOrDefault(uuid, 0);

        if (isBuriedOre) {
            streak++;
            hiddenOreStreak.put(uuid, streak);
            data.setBuriedOreStreak(streak);
        } else {
            // Naturally exposed to open cave air (>= 3 open faces)
            streak = Math.max(0, streak - 1);
            hiddenOreStreak.put(uuid, streak);
            data.setBuriedOreStreak(streak);
        }

        // Detect X-Ray: tunneling straight into buried ores with insufficient natural tunneling
        boolean suspiciousXray = isBuriedOre && (streak >= maxHiddenOreStreak || stoneCount < minStoneBetweenOres);

        if (suspiciousXray) {
            String details = String.format("Mined buried %s (Buried: %d/6 solid, Stone tunnel: %d, Streak: %d)",
                    mat.name().toLowerCase(), solidFaces, stoneCount, streak);

            // Flag anti-cheat violation
            flag(player, data, details, 2.0);

            // Reset stone counter
            stoneMinedSinceLastOre.put(uuid, 0);

            // Actively block the X-Ray exploitation
            if (blockOre) {
                event.setCancelled(true);
                event.setDropItems(false);

                if (replaceWithStone) {
                    Material replacement = mat.name().contains("DEEPSLATE") || block.getY() < 0 ? Material.DEEPSLATE
                            : (mat == Material.ANCIENT_DEBRIS || mat == Material.NETHER_GOLD_ORE) ? Material.NETHERRACK
                            : Material.STONE;
                    block.setType(replacement, false);
                }

                // Audio & visual crumbling effect
                player.getWorld().spawnParticle(Particle.SMOKE, block.getLocation().add(0.5, 0.5, 0.5), 10, 0.25, 0.25, 0.25, 0.02);
                player.playSound(block.getLocation(), Sound.BLOCK_FIRE_EXTINGUISH, 0.8F, 1.2F);

                player.sendMessage(plugin.getConfigManager().getMessages().getComponent(
                        "punish.xray-blocked",
                        "<prefix><red>This ore crumbled away as you touched it...</red>",
                        Map.of("player", player.getName(), "ore", mat.name().toLowerCase())
                ));

                // Alert online staff members
                String staffAlert = String.format(
                        "<#FF0000>[Bayon AntiCheat]</#FF0000> <red>Blocked X-Ray ore break from <yellow>%s</yellow> (<white>%s</white>, Solid: %d/6, Tunnel: %d blk)</red>",
                        player.getName(), mat.name().toLowerCase(), solidFaces, stoneCount
                );
                for (Player staff : Bukkit.getOnlinePlayers()) {
                    if (staff.hasPermission("nexora.alerts")) {
                        staff.sendMessage(MiniMessage.miniMessage().deserialize(staffAlert));
                    }
                }
            }
        } else {
            // Legitimate mining find
            stoneMinedSinceLastOre.put(uuid, 0);
            data.incrementValuableOresMined();
        }
    }

    /**
     * Counts how many of the 6 surrounding adjacent faces are solid opaque blocks.
     * Buried ores typically have 4, 5, or 6 solid faces.
     */
    private int countSolidSurroundingFaces(Block block) {
        int solidCount = 0;
        for (BlockFace face : ADJACENT_FACES) {
            Block relative = block.getRelative(face);
            Material type = relative.getType();
            if (type.isSolid() && !type.isAir()) {
                solidCount++;
            }
        }
        return solidCount;
    }
}
