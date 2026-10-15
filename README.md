# Nexora AntiCheat

<p align="center">
  <img src="https://img.shields.io/badge/Minecraft-26.2-red.svg" alt="Minecraft 26.2" />
  <img src="https://img.shields.io/badge/Platform-Paper%20%2F%20Folia-orange.svg" alt="Paper / Folia" />
  <img src="https://img.shields.io/badge/Java-21%2B-blue.svg" alt="Java 21+" />
  <img src="https://img.shields.io/badge/Prefix-%23FF0000-brightgreen.svg" alt="Prefix #FF0000" />
</p>

**Nexora AntiCheat** is an enterprise-grade, lag-compensated anti-cheat plugin engineered from the ground up for modern **Paper 26.2** and **Folia** Minecraft servers. Nexora prioritizes **near-zero false positives** over reckless detection, featuring advanced statistical analysis, vector ray-tracing, server-sent velocity tracking, and asynchronous multi-backend persistence.

---

## 🛡️ Detection Modules

### 1. Movement Checks
* **Speed**: Horizontal displacement tracking accounting for ground, air friction, sprint, ice types, potion effects, and sprint-jump launch impulses. Supports Bedrock tolerance multipliers.
* **Fly**: Detects hovering in air, ascending without jump boost, and unnatural gravity curve deviations.
* **NoFall**: Identifies spoofed client ground packets when the actual distance to solid terrain exceeds tolerance.
* **Jesus / WaterWalk**: Flags players walking or jumping across water/lava surfaces without Frost Walker or boats.
* **Step**: Prevents instantaneous single-tick block stepping without jumping or stair/slab mechanics.
* **Phase / NoClip**: Prevents movement and clipping through occluding solid blocks, walls, and doors.
* **Timer**: Clock drift and packet frequency monitor catching speedup modifications beyond 20 ticks/sec.
* **InvalidMovement**: Blocks impossible pitch angles (`>90°` or `<-90°`), NaN/infinite coordinates, and abnormal displacement jumps.

### 2. Combat Checks
* **KillAura**: Field of view angle verification, rotation snap detection, and rapid multi-target switching.
* **Reach**: Accurate ray-box distance calculations against entity bounding boxes, compensating for player ping. Features **Trident / Riptide spear-swap detection** allowing extended reach windows (up to 6.2 blocks) during riptide launches without false flags.
* **AutoClicker**: High CPS threshold enforcement and statistical interval variance analysis to flag macros.
* **Velocity / Anti-Knockback**: Validates that players appropriately accept and apply server-sent vertical/horizontal knockback.
* **HitBox**: Ray-traces attacker line-of-sight to catch expanded target collision volumes.

### 3. World Checks
* **FastBreak**: Verifies block mining time against item tools, enchantments (Efficiency), and potion effects (Haste/Fatigue).
* **Nuker**: Prevents breaking multiple blocks in a single tick or in sub-50ms windows.
* **Scaffold**: Detects impossible bridging angles, placing blocks behind the player's back, or downward sprint bridging without sneaking.
* **FastPlace**: Enforces the vanilla 4-tick (200ms) block placement cooldown.
* **Tower**: Flags rapid vertical pillar bridging without legitimate jump delays.
* **GhostHand**: Prevents mining or interacting with blocks through intervening solid walls.
* **XRay**: Detects ore ESP, tunneling, and buried ore mining. Rather than kicking players, it directly **blocks the ore** (crumbles/turns to stone and cancels drops) to protect the economy without false kicks.
* **AntiDupe**: Detects item duplication exploits (rapid pickup bursts, illegal stack count jumps, and high-frequency crafting result extractions).

### 4. Player & Protocol Checks
* **BadPackets**: Catches out-of-bound hotbar slots (`<0` or `>8`) and impossible packet combinations (simultaneous sprint and sneak).
* **Inventory (InvMove)**: Flags inventory manipulations performed while in high-speed sprint or combat.
* **FastEat / FastUse**: Enforces minimum consumption duration (28–32 ticks) on food and potions.
* **Exploit**: Guards against oversized book NBT payloads, sign line overflows, and crash packets.
* **ClientBrand**: Inspects client brand handshakes against a configurable blacklist (e.g. Meteor, Wurst, LiquidBounce, Impact, Aristois) and kicks unauthorized clients.

---

## ⚡ Key Technical Features

* **Paper 26.2 & Folia Native**: Built using modern `paper-plugin.yml`, `LifecycleEvents.COMMANDS`, and Mojang Brigadier command trees. Fully Folia region-thread and async scheduler compatible (`TaskUtil`).
* **Bedrock & GeyserMC Support**: Auto-detects Geyser/Floodgate Bedrock players via Floodgate API (reflection), name prefix (default `.`), or `nexora.bedrock` permission, granting relaxed movement/combat thresholds and skipping incompatible packet checks.
* **Progressive Ban Escalation (3 Kicks -> Ban)**: Tracks kick violations across sessions in SQLite/MySQL. Every 3 kicks automatically escalates punishment through tiered durations:
  * **Tier 1**: 24 Hours
  * **Tier 2**: 7 Days
  * **Tier 3**: 30 Days
  * **Tier 4**: Permanent Ban + Automatic IP Ban
* **Cracked / Offline-Mode Detection**: On online-mode servers, detects offline-mode UUID version 3 clients attempting to connect and immediately issues a permanent ban and IP ban.
* **Discord Punishment Webhook**:
  * Configured to send embeds **only on Kicks and Bans** (no spam).
  * Embeds include player skin avatar thumbnails (`https://mc-heads.net/avatar/{name}/64`).
  * Full telemetry: Player Name, UUID, Action & Duration, Platform (`CRACKED` vs `PREMIUM`), Check ID, Category, VL, Ping, Server TPS, Client Brand, and optional masked IP address.
* **Adventure MiniMessage**: Clean formatting featuring `#FF0000` brand colors.
* **Storage Options**: Zero-configuration embedded **SQLite** out-of-the-box, with optional high-concurrency **MySQL** pooling via HikariCP.
* **Zero Telemetry**: 100% telemetry-free and privacy-friendly (no bStats).

---

## 📋 Commands & Permissions

Main command: `/nxanti` (aliases: `/nexora`, `/nxac`)

| Command | Permission | Description |
|---|---|---|
| `/nxanti help` | `nexora.command.help` | View help and command overview |
| `/nxanti reload` | `nexora.command.reload` | Hot-reload all configurations without restart |
| `/nxanti alerts [on\|off]` | `nexora.alerts` | Toggle staff cheat violation alerts |
| `/nxanti info <player>` | `nexora.command.info` | View live telemetry, ping, and check VLs for a player |
| `/nxanti history <player>` | `nexora.command.history` | View persisted violation logs from database for online & offline players |
| `/nxanti bans <player>` | `nexora.command.bans` | View ban records, duration, and escalation history for a player |
| `/nxanti unban <player\|ip>` | `nexora.command.unban` | Pardon a banned player or IP address and reset their kick counter |
| `/nxanti reset <player>` | `nexora.command.reset` | Clear all active violation levels for a player |
| `/nxanti punish <player> <reason>` | `nexora.command.punish` | Manually execute punishment on a player |
| `/nxanti exempt <player> [duration]` | `nexora.command.exempt` | Temporarily exempt player (e.g. `1m`, `5m`, `1h`) |
| `/nxanti gui` | `nexora.command.gui` | Open the interactive staff moderation GUI |
| `/nxanti debug <check>` | `nexora.command.debug` | Toggle debug verbose mode for a check |

### Additional Permissions
* `nexora.admin`: Full administrative access (grants all `nexora.*` permissions).
* `nexora.bypass`: Bypasses all anti-cheat detections.
* `nexora.bypass.<check>`: Bypasses a specific check (e.g., `nexora.bypass.speed`).
* `nexora.bedrock`: Explicitly marks a player as a Bedrock client (applies relaxed thresholds).

---

## 🔨 Building from Source

### Requirements
* Java Development Kit (JDK) 21 or newer
* Apache Maven 3.8+

### Build Command
```bash
mvn clean package -o
```

The compiled JAR will be output to:
```
target/nexora-anticheat-1.0.0.jar
```
Drop this JAR into your server's `plugins/` directory and restart your server.

---

## 🌐 Nexora Web Panel & Fleet Management

The repository includes a modern React + Node.js Web Panel located in the [`panel/`](panel/) directory:

* **👑 Admin Fleet Control Panel**:
  * Real-time fleet monitor displaying active servers, TPS, online player counts, and ping.
  * Remote killswitch & server ban buttons: Instantly ban servers violating policy with custom reasons.
  * Cryptographic License Key Generator (`NX-XXXX-XXXX-XXXX`) with tier selection (STARTER, PRO, ENTERPRISE, LIFETIME) and expiration management.
* **👤 Buyer / Client Self-Service Portal**:
  * Server owners log in using their license key.
  * View bound server status, connected host IP, and live anti-cheat violation logs.
  * One-click "Reset Server IP Binding" button when migrating hosting providers.
* **💻 Website Embed & Buy Form Widget**:
  * Ready-to-use HTML/JS embed codes to integrate license verification or status widgets directly into your website, Tebex, or Discord bot.

---

## 🚀 1-Click Render Deployment (Free Tier & Singapore Region)

This repository includes a native [Render Blueprint](render.yaml) (`render.yaml`) pre-configured for **Render's Free Tier** in the **Singapore** region.

### Steps to Deploy:
1. Log in to [Render.com](https://render.com).
2. Click **Blueprints** -> **New Blueprint Instance**.
3. Connect your GitHub repository: `https://github.com/yuonsovann5656-netizen/Nexora-AntiCheat.git`.
4. Render will automatically detect [`render.yaml`](render.yaml):
   * **Service Name**: `nexora-panel`
   * **Plan**: `free` ($0/month)
   * **Region**: `singapore` (`singapore`)
   * **Runtime**: `Node`
5. In the Environment settings, add your Supabase connection string:
   * **Key**: `DATABASE_URL`
   * **Value**: `postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres`
6. Click **Apply**. Your panel will build and be live at `https://nexora-panel.onrender.com` within minutes!

---

## 🐘 Supabase PostgreSQL Setup

Nexora Panel supports high-performance **Supabase PostgreSQL** with automated table migration and zero manual configuration:

1. Create a free account at [Supabase.com](https://supabase.com).
2. Create a new project and select **Singapore (ap-southeast-1)** for lowest latency to your Render service.
3. Go to **Project Settings** -> **Database** -> **Connection string** (URI).
4. Copy the URI and paste it into Render's `DATABASE_URL` environment variable.
5. (Optional) Run [`supabase_schema.sql`](supabase_schema.sql) in the Supabase SQL Editor if you want to inspect or customize tables manually. Tables will also be auto-created on startup!
6. If `DATABASE_URL` is not set, the panel seamlessly falls back to local JSON storage (`backend/data/nexora_store.json`).

---

## ⚙️ Minecraft Server Configuration

In your server's `plugins/NexoraAntiCheat/config.yml`:

```yaml
license:
  enabled: true
  key: "NX-DEMO-2026-KEY1"                      # Your issued license key
  api-url: "https://nexora-panel.onrender.com"   # Your deployed Render panel URL
  heartbeat-interval-seconds: 60                # Telemetry sync interval
  enforce-hardware-binding: true                # Lock key to your server IP
```
