# Nexora AntiCheat Web Panel & License Authority

<p align="center">
  <img src="https://img.shields.io/badge/Nexora-Panel%20v1.0-red.svg" alt="Nexora Panel v1.0" />
  <img src="https://img.shields.io/badge/Stack-React%20%2B%20Express-blue.svg" alt="Stack" />
  <img src="https://img.shields.io/badge/Port-3000-green.svg" alt="Port 3000" />
</p>

A complete licensing, remote management, and fleet telemetry web application for **Nexora AntiCheat**.

---

## 🚀 Features

### 1. 👑 Admin Dashboard (For Plugin Owner / Developer)
* **Server Fleet Host Counter**: Live counter displaying total Minecraft servers running your plugin and active servers online.
* **Server Fleet Monitor**: Real-time table displaying Server Name, Host IP & Port, Minecraft/Paper Version, Online Players, Live TPS, and Last Ping.
* **One-Click Server Ban**: Click **[🚫 Ban Server]** from the web panel to immediately revoke the license key. The running server automatically detects the ban via heartbeat and shuts down the anti-cheat plugin!
* **Cryptographic Key Generator**:
  * Format: `NX-XXXX-XXXX-XXXX`
  * Tiers: **Lifetime**, **1 Year**, **30 Days**, or **Custom Days**.
  * Strict Host Limits: Configure max allowed servers per key (default: 1 single host).
* **IP Binding & Reset**: Enforces 1 server per key. Allows resetting IP binding when a buyer moves to new server hosting.

### 2. 👤 Buyer / Customer Portal
* Customer logs in with their purchased License Key.
* View bound server status (Online/Offline, TPS gauge, Online Player count).
* Live AntiCheat Violation History synced from their server.
* Self-service **[🔄 Reset Server IP Binding]** button.

### 3. 🔌 Website Embed Form & Key Generation
* Ready-to-copy HTML/JavaScript widget to embed on Tebex, CraftingStore, or your custom website for instant license key generation during customer checkout.

---

## 🏃 Running the Web Panel

```bash
cd C:\Users\Chiro\.gemini\antigravity\scratch\nexora-panel

# Install dependencies (already completed)
npm install

# Start production server (serves API & React UI on http://localhost:3000)
npm start
```

Open your browser to:
**`http://localhost:3000`**

---

## ⚙️ Connecting Your Minecraft Server

In your Minecraft server's `plugins/NexoraAntiCheat/config.yml`:

```yaml
license:
  enabled: true
  key: "NX-DEMO-2026-KEY1" # Enter the key generated in the Admin Panel
  server-name: "My Minecraft Server"
  api-url: "http://localhost:3000/api" # Replace with your domain in production
  heartbeat-interval-seconds: 60
  allow-offline-grace: true
```

* On startup: The plugin authenticates with the Web Panel and binds to your server IP.
* Every 60 seconds: Telemetry (TPS, player count, recent flags) syncs to the Web Panel.
* If banned remotely: The plugin safely disables itself automatically.
