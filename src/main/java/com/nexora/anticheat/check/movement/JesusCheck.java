package com.nexora.anticheat.check.movement;

import com.nexora.anticheat.NexoraPlugin;
import com.nexora.anticheat.check.Check;
import com.nexora.anticheat.check.CheckCategory;
import com.nexora.anticheat.data.PlayerData;
import com.nexora.anticheat.util.LocationUtil;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.inventory.ItemStack;
import org.jetbrains.annotations.NotNull;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Detects Jesus / WaterWalk hacks where players walk directly on water or lava surfaces.
 */
public class JesusCheck extends Check {

    private int maxLiquidTicks = 3;
    private final Map<UUID, Integer> liquidTicks = new ConcurrentHashMap<>();

    public JesusCheck(@NotNull NexoraPlugin plugin) {
        super(plugin, "Jesus", "Jesus / WaterWalk", CheckCategory.MOVEMENT);
    }

    @Override
    protected void loadCustomConfig(@NotNull FileConfiguration config, @NotNull String path) {
        this.maxLiquidTicks = config.getInt(path + ".max-liquid-ticks", 3);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent event) {
        Player player = event.getPlayer();
        PlayerData data = plugin.getPlayerDataManager().getData(player);
        if (data == null || shouldSkip(player, data)) {
            return;
        }

        if (player.isGliding() || player.isFlying() || player.isInsideVehicle() || player.isRiptiding()) {
            liquidTicks.remove(player.getUniqueId());
            return;
        }

        // Frost Walker boots check
        ItemStack boots = player.getInventory().getBoots();
        if (boots != null && boots.containsEnchantment(Enchantment.FROST_WALKER)) {
            liquidTicks.remove(player.getUniqueId());
            return;
        }

        Location to = event.getTo();
        Block footBlock = to.getBlock();
        Block belowBlock = to.clone().subtract(0, 0.4, 0).getBlock();

        boolean onLiquid = (belowBlock.isLiquid() || footBlock.isLiquid()) && !LocationUtil.isNearGround(to);

        if (onLiquid && player.isOnGround()) {
            int ticks = liquidTicks.compute(player.getUniqueId(), (k, v) -> v == null ? 1 : v + 1);
            if (ticks > maxLiquidTicks) {
                flag(player, data, String.format("Walking on liquid surface for %d ticks", ticks), 1.0);
            }
        } else {
            liquidTicks.remove(player.getUniqueId());
        }
    }
}
