package com.nexora.anticheat.api;

import org.bukkit.entity.Player;
import org.bukkit.event.Cancellable;
import org.bukkit.event.Event;
import org.bukkit.event.HandlerList;
import org.jetbrains.annotations.NotNull;

/**
 * Event called when a player exceeds the maximum violation level for a check
 * and a punishment (e.g. kick, ban, custom command) is queued.
 * Cancelling this event prevents the punishment from executing.
 */
public class NexoraPunishEvent extends Event implements Cancellable {

    private static final HandlerList HANDLERS = new HandlerList();

    private final Player player;
    private final String checkId;
    private final String punishmentType;
    private final String reason;
    private boolean cancelled;

    public NexoraPunishEvent(@NotNull Player player,
                             @NotNull String checkId,
                             @NotNull String punishmentType,
                             @NotNull String reason) {
        super(!org.bukkit.Bukkit.isPrimaryThread());
        this.player = player;
        this.checkId = checkId;
        this.punishmentType = punishmentType;
        this.reason = reason;
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
    public String getPunishmentType() {
        return punishmentType;
    }

    @NotNull
    public String getReason() {
        return reason;
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
