package com.nexora.anticheat.api;

import org.bukkit.entity.Player;
import org.bukkit.event.Cancellable;
import org.bukkit.event.Event;
import org.bukkit.event.HandlerList;
import org.jetbrains.annotations.NotNull;

/**
 * Event called whenever an anti-cheat check flags a player for suspicious behavior.
 * This event is cancellable. Cancelling the event prevents the violation level from increasing
 * and suppresses alerts and setbacks.
 */
public class NexoraFlagEvent extends Event implements Cancellable {

    private static final HandlerList HANDLERS = new HandlerList();

    private final Player player;
    private final String checkId;
    private final String checkCategory;
    private final double addedVl;
    private final double totalVl;
    private final String details;
    private boolean cancelled;

    public NexoraFlagEvent(@NotNull Player player,
                           @NotNull String checkId,
                           @NotNull String checkCategory,
                           double addedVl,
                           double totalVl,
                           @NotNull String details) {
        super(!org.bukkit.Bukkit.isPrimaryThread());
        this.player = player;
        this.checkId = checkId;
        this.checkCategory = checkCategory;
        this.addedVl = addedVl;
        this.totalVl = totalVl;
        this.details = details;
        this.cancelled = false;
    }

    @NotNull
    public Player getPlayer() {
        return player;
    }

    @NotNull
    public String getCheckId() {
        return checkId;
    }

    @NotNull
    public String getCheckCategory() {
        return checkCategory;
    }

    public double getAddedVl() {
        return addedVl;
    }

    public double getTotalVl() {
        return totalVl;
    }

    @NotNull
    public String getDetails() {
        return details;
    }

    @Override
    public boolean isCancelled() {
        return cancelled;
    }

    @Override
    public void setCancelled(boolean cancel) {
        this.cancelled = cancel;
    }

    @NotNull
    @Override
    public HandlerList getHandlers() {
        return HANDLERS;
    }

    @NotNull
    public static HandlerList getHandlerList() {
        return HANDLERS;
    }
}
