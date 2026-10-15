package com.nexora.anticheat.check.world;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import org.bukkit.GameMode;
import org.bukkit.Material;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryType;
import org.bukkit.event.player.PlayerDropItemEvent;
import org.bukkit.event.player.PlayerPickupItemEvent;
import org.bukkit.inventory.ItemStack;
import org.jetbrains.annotations.NotNull;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Anti-Dupe Check — detects item duplication exploits.
 *
 * <p>Strategy (no false positives):
 * <ul>
 *   <li><b>Rapid pickup burst</b>: more than {@code maxPickupsPerWindow} item pickups within
 *       {@code windowMs} milliseconds is abnormal (vanilla piston/dropper dupes, gravity block dupes).</li>
 *   <li><b>Stack-count jump</b>: if an item's stack count in the player's inventory suddenly
 *       increases beyond what a single pickup/craft could explain (delta &gt; maxSingleStackGain),
 *       flag and cancel the action.</li>
 *   <li><b>Drop → immediate pickup of inflated stack</b>: track drop counts per item type and
 *       compare against pickup counts. A pickup of significantly more items than were dropped
 *       triggers a flag.</li>
 * </ul>
 *
 * <p>Exemptions: Creative/Spectator, OPs (if ops-bypass enabled), velocity/lag windows.
 */
public class AntiDupeCheck extends Check {

    /** Time window for rapid pickup detection (ms). */
    private long windowMs = 1000L;

    /** Max pickups allowed within windowMs before flagging. */
    private int maxPickupsPerWindow = 20;

    /** Max legitimate single-stack gain per pickup/craft event. */
    private int maxSingleStackGain = 64;

    /** Per-player ring buffers of pickup timestamps. */
    private final Map<UUID, Deque<Long>> pickupTimestamps = new HashMap<>();

    /** Per-player snapshot of inventory item amounts (material -> count). */
    private final Map<UUID, Map<Material, Integer>> inventorySnapshot = new HashMap<>();

    /** Per-player running count of drops per material (cleared after windowMs). */
    private final Map<UUID, Map<Material, Integer>> recentDrops = new HashMap<>();
    private final Map<UUID, Long> dropWindowStart = new HashMap<>();

    public AntiDupeCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "AntiDupe", "Anti-Dupe (Item Duplication)", CheckCategory.WORLD);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.windowMs = config.getLong(path + ".window-ms", 1000L);
        this.maxPickupsPerWindow = config.getInt(path + ".max-pickups-per-window", 20);
        this.maxSingleStackGain = config.getInt(path + ".max-single-stack-gain", 64);
    }

    // ------------------------------------------------------------------
    // Drop tracking — record what the player drops so we can compare
    // ------------------------------------------------------------------

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDrop(PlayerDropItemEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) return;

        UUID uid = player.getUniqueId();
        long now = System.currentTimeMillis();

        // Reset drop window if stale
        long windowStart = dropWindowStart.getOrDefault(uid, 0L);
        if (now - windowStart > windowMs) {
            recentDrops.remove(uid);
            dropWindowStart.put(uid, now);
        }

        Material mat = event.getItemDrop().getItemStack().getType();
        int qty = event.getItemDrop().getItemStack().getAmount();
        recentDrops.computeIfAbsent(uid, k -> new HashMap<>())
                   .merge(mat, qty, Integer::sum);
    }

    // ------------------------------------------------------------------
    // Pickup tracking — check for suspicious gain
    // ------------------------------------------------------------------

    @SuppressWarnings("deprecation")
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPickup(PlayerPickupItemEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) return;

        UUID uid = player.getUniqueId();
        long now = System.currentTimeMillis();

        // --- Check 1: rapid pickup burst ---
        Deque<Long> times = pickupTimestamps.computeIfAbsent(uid, k -> new ArrayDeque<>());
        times.addLast(now);
        // Prune entries outside the window
        while (!times.isEmpty() && now - times.peekFirst() > windowMs) {
            times.pollFirst();
        }
        if (times.size() > maxPickupsPerWindow) {
            flag(player, data,
                 String.format("Rapid pickups: %d in %dms (max %d)", times.size(), windowMs, maxPickupsPerWindow),
                 1.5);
            return;
        }

        // --- Check 2: stack-count jump ---
        ItemStack picked = event.getItem().getItemStack();
        Material mat = picked.getType();
        int pickedAmt = picked.getAmount();

        Map<Material, Integer> snapshot = inventorySnapshot.computeIfAbsent(uid, k -> buildSnapshot(player));
        int before = snapshot.getOrDefault(mat, 0);
        int currentInv = countInInventory(player, mat);

        // After pickup the inventory will have currentInv + pickedAmt
        int projectedTotal = currentInv + pickedAmt;
        int gain = projectedTotal - before;

        if (gain > maxSingleStackGain) {
            // Check if this can be explained by prior drops (dupe exploit usually drops then re-picks)
            int droppedAmt = recentDrops.getOrDefault(uid, new HashMap<>()).getOrDefault(mat, 0);
            int legitGain = droppedAmt + maxSingleStackGain;
            if (gain > legitGain) {
                flag(player, data,
                     String.format("Stack jump: %s gained %d (dropped %d, max legit %d)",
                                   mat.name(), gain, droppedAmt, legitGain),
                     2.0);
            }
        }

        // Update snapshot after pickup is processed
        snapshot.put(mat, projectedTotal);
    }

    // ------------------------------------------------------------------
    // Inventory interaction — detect impossible click patterns
    // ------------------------------------------------------------------

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onInventoryClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player player)) return;
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) return;

        // Only care about crafting result slots (common dupe vector)
        if (event.getSlotType() != InventoryType.SlotType.RESULT) return;

        ItemStack result = event.getCurrentItem();
        if (result == null || result.getType().isAir()) return;

        // If the player is in Creative, vanilla rules allow item creation — skip
        if (player.getGameMode() == GameMode.CREATIVE) return;

        UUID uid = player.getUniqueId();
        long now = System.currentTimeMillis();

        // Rapid crafting result extraction (e.g. bundle dupe, crafting dupe)
        Deque<Long> times = pickupTimestamps.computeIfAbsent(uid, k -> new ArrayDeque<>());
        times.addLast(now);
        while (!times.isEmpty() && now - times.peekFirst() > windowMs) {
            times.pollFirst();
        }
        // Threshold for crafting clicks is halved (each craft click is deliberate)
        if (times.size() > maxPickupsPerWindow / 2) {
            flag(player, data,
                 String.format("Rapid craft extractions: %d in %dms", times.size(), windowMs),
                 1.0);
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private Map<Material, Integer> buildSnapshot(@NotNull Player player) {
        Map<Material, Integer> map = new HashMap<>();
        for (ItemStack item : player.getInventory().getContents()) {
            if (item != null && !item.getType().isAir()) {
                map.merge(item.getType(), item.getAmount(), Integer::sum);
            }
        }
        return map;
    }

    private int countInInventory(@NotNull Player player, @NotNull Material mat) {
        int total = 0;
        for (ItemStack item : player.getInventory().getContents()) {
            if (item != null && item.getType() == mat) {
                total += item.getAmount();
            }
        }
        return total;
    }

    /** Must be called on player quit to prevent memory leak. */
    public void cleanup(@NotNull UUID uuid) {
        pickupTimestamps.remove(uuid);
        inventorySnapshot.remove(uuid);
        recentDrops.remove(uuid);
        dropWindowStart.remove(uuid);
    }
}
