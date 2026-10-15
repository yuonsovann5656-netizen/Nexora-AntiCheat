package com.nexora.anticheat.check.combat;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.BedrockUtil;
import com.nexora.anticheat.util.RayTraceUtil;
import org.bukkit.GameMode;
import org.bukkit.Material;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.player.PlayerItemHeldEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.enchantments.Enchantment;
import org.jetbrains.annotations.NotNull;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Detects reach hacks where players hit targets from beyond valid bounding-box distances.
 *
 * <p><b>Trident / Spear-swap fix (v1.1)</b>: The Trident's Riptide enchantment causes the
 * player to physically lunge, reaching up to ~5–6 blocks on the launch tick. Additionally,
 * players can "spear swap" by switching to a trident mid-air after a riptide lunge to
 * extend their effective melee range for a short window. We now:
 * <ul>
 *   <li>Track item-hold changes to detect when a player just equipped a Trident.</li>
 *   <li>Grant an extended reach window ({@code tridentExtendedReach}) for
 *       {@code tridentWindowMs} milliseconds after switching to a Trident or while riptiding.</li>
 *   <li>Apply Bedrock-specific reach tolerance (Bedrock client hit detection differs).</li>
 * </ul>
 */
public class ReachCheck extends Check {

    // ------------------------------------------------------------------ config
    private double maxReach            = 3.15;
    private double creativeReach       = 5.2;
    /** Extended reach allowed when the player is holding a Trident or riptiding. */
    private double tridentExtendedReach = 6.2;
    /** Time window (ms) after equipping a Trident where extended reach is allowed. */
    private long   tridentWindowMs     = 800L;
    /** Extra reach tolerance for Bedrock players (blocks). */
    private double bedrockTolerance    = 0.50;

    /** Tracks the last time each player switched to holding a Trident (ms timestamp). */
    private final Map<UUID, Long> lastTridentEquip = new ConcurrentHashMap<>();

    public ReachCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Reach", "Reach (Combat Distance)", CheckCategory.COMBAT);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.maxReach             = config.getDouble(path + ".max-reach",              3.15);
        this.creativeReach        = config.getDouble(path + ".creative-reach",         5.2);
        this.tridentExtendedReach = config.getDouble(path + ".trident-extended-reach", 6.2);
        this.tridentWindowMs      = config.getLong(path + ".trident-window-ms",        800L);
        this.bedrockTolerance     = config.getDouble(path + ".bedrock-tolerance",      0.50);
    }

    // ------------------------------------------------------------------
    // Track Trident equip
    // ------------------------------------------------------------------

    @EventHandler(priority = EventPriority.MONITOR)
    public void onItemHeld(PlayerItemHeldEvent event) {
        Player player = event.getPlayer();
        ItemStack newItem = player.getInventory().getItem(event.getNewSlot());
        if (newItem != null && newItem.getType() == Material.TRIDENT) {
            lastTridentEquip.put(player.getUniqueId(), System.currentTimeMillis());
        }
    }

    // ------------------------------------------------------------------
    // Reach detection
    // ------------------------------------------------------------------

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onAttack(EntityDamageByEntityEvent event) {
        if (!(event.getDamager() instanceof Player player)) return;

        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) return;

        Entity target   = event.getEntity();
        double distance = RayTraceUtil.getDistanceToBox(player.getEyeLocation(), target);

        // Ping compensation allowance (≈ 0.001 blocks per ms of ping, capped at 0.30)
        double pingAllowance = Math.min(0.30, player.getPing() * 0.001);

        double threshold;
        if (player.getGameMode() == GameMode.CREATIVE) {
            threshold = creativeReach + pingAllowance;
        } else if (isTridentWindow(player)) {
            // Player is riptiding OR just swapped to trident — apply extended reach
            threshold = tridentExtendedReach + pingAllowance;
        } else {
            threshold = maxReach + pingAllowance;
        }

        // Bedrock clients use slightly different hit-boxes / lag
        if (BedrockUtil.isBedrock(player)) {
            threshold += bedrockTolerance;
        }

        if (distance > threshold) {
            double excess = distance - threshold;
            flag(player, data,
                 String.format("Reach: %.2f > Max: %.2f (Ping: %dms, Excess: +%.2f, Trident: %b)",
                               distance, threshold, player.getPing(), excess, isTridentWindow(player)),
                 1.0);
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private boolean isTridentWindow(@NotNull Player player) {
        // Active riptide lunge
        if (player.isRiptiding()) return true;

        // Recently switched to trident hand-slot
        Long equipTime = lastTridentEquip.get(player.getUniqueId());
        if (equipTime != null && System.currentTimeMillis() - equipTime < tridentWindowMs) {
            // Make sure they actually still hold a Trident (didn't switch away)
            ItemStack held = player.getInventory().getItemInMainHand();
            if (held.getType() == Material.TRIDENT) {
                return true;
            }
        }
        return false;
    }
}
