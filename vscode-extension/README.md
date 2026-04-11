<h1 align="center">DevGlobe for VS Code</h1>

<p align="center">
  <strong>Show up on a 3D globe in real time while you code.</strong><br/>
  Your activity is displayed live on <a href="https://devglobe.xyz">devglobe.xyz</a> — other developers see you, discover your projects and your links.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=devglobe.devglobe">VS Code Marketplace</a> &nbsp;·&nbsp;
  <a href="https://devglobe.xyz">devglobe.xyz</a> &nbsp;·&nbsp;
  <a href="https://github.com/Nako0/devglobe-extension">Source code</a>
</p>

---

> **Open source & transparent** — This extension is 100% open source. No code is read, no sensitive data is collected. You can audit every line on [GitHub](https://github.com/Nako0/devglobe-extension).

---

## How it works

1. Sign in on [devglobe.xyz](https://devglobe.xyz) with GitHub, X (Twitter), or Google
2. Copy your API key from the site settings
3. Open the **DevGlobe** sidebar in VS Code (globe icon in the activity bar)
4. Paste your API key → **Connect**
5. You're online — your marker appears on the globe

The extension sends a **heartbeat every 30 seconds** as long as you're actively coding. It pauses after 1 minute of inactivity. **After 10 minutes of inactivity, you disappear from the globe.**

---

## Features

| Feature | Description |
|---------|-------------|
| **Live heartbeat** | Sends your activity every 30s. Auto-pauses after 1 min of inactivity. |
| **Language detection** | Detects 150+ languages from your active editor tab. |
| **Platform detection** | Sends your OS (macOS, Windows or Linux) alongside each heartbeat so it appears on your profile. |
| **Git integration** | Detects your repo from the git remote. Commit data is never read or sent by the extension. |
| **Anonymous mode** | Hide your exact location — your marker is placed on a random city in your country (from a database of 152,000+ cities worldwide). |
| **Status message** | Write what you're working on — visible on your globe profile. |
| **Repo sharing** | **You decide.** Your repo name is never shown unless you explicitly enable this toggle (disabled by default). |
| **Offline recovery** | Detects connection loss and automatically resumes when the network is back. |
| **Status bar** | Displays your coding time for today (e.g. `2h 15m`) in the VS Code status bar. |

### Sidebar

Two views in the side panel:

- **Login** — masked API key field + link to get your key on devglobe.xyz
- **Dashboard** — live coding time, active language, status message, repo sharing toggle, start/stop buttons, logout

### Command

`DevGlobe: Set Status Message` — accessible from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `devglobe.trackingEnabled` | `true` | Enable/disable tracking |
| `devglobe.shareRepo` | `false` | Make your repo name visible on the globe |
| `devglobe.anonymousMode` | `false` | Hide your exact location — your marker is placed on a random city in your country (from a database of 152,000+ cities worldwide) |
| `devglobe.statusMessage` | `""` | Your status message (max 100 characters) |

---

## What DevGlobe brings you

- **Enhanced public profile** — Your GitHub, X, projects, activity, tech stack and links on a single shareable page.
- **Project directory** — Publish your projects, invite teammates, get discovered and upvoted by the community.
- **Comments & upvotes** — Threaded discussions on every project. Give and get feedback from other developers.
- **Developer dashboard** — One place to manage your profile, projects and extensions, track coding stats, unlock badges and read notifications.
- **Discovery** — Browse and filter developers & projects by language, tools and platform.
- **Networking** — See who's coding right now and in which language. Click a marker to discover a developer, their projects and their links.
- **Light & dark mode** — Full theme support across the platform.

---

## On devglobe.xyz

- **3D globe** with active developers in real time (colored markers or GitHub avatars)
- **Enhanced public profiles** — projects, activity, tech stack, links, fully shareable
- **Project directory** — browse, filter and upvote projects by language, tools and platform
- **Threaded comments & upvotes** on every project
- **Developer dashboard** — profile, projects, extensions, coding stats, badges and notifications in one place
- **Discovery** — search and filter developers by stack
- **Detailed stats** — today's time, streak, language breakdown over 30 days
- **Light & dark mode** across the platform
- **Activity feed** — who just connected, who left

**Account deletion** — If you delete your account, all your data is erased. No information is kept.

---

## Privacy & Security

### What the extension sends

| Data | Sent | Detail |
|------|------|--------|
| Programming language | Yes | The language name of your active tab (e.g. "TypeScript"). Nothing else. |
| Operating system | Yes | One of `macOS`, `Windows` or `Linux`. Displayed on your profile next to your coding stats. |
| Approximate location | Yes | City + coordinates **snapped to your city center** (from a database of 152,000+ cities). You appear as an area on the globe, not an address. |
| Repo name | **You decide** | `owner/repo` is **only sent to the server if you enable the "Share repo" toggle** (disabled by default). When disabled, your repo name never leaves your IDE. |
| Anonymous mode | **You decide** | When enabled, your real coordinates are replaced with a random city in your country (from a database of 152,000+ cities worldwide). Your actual location is never sent to DevGlobe. |
| Coding time | Yes | Accumulated per day, per language. Server-side rate-limited to prevent abuse. |
| Status message | Yes | Only what you write yourself. |

### What the extension does NOT send

| Data | Sent |
|------|------|
| Your source code | **Never** |
| Your file contents | **Never** |
| Your file names | **Never** |
| Your folder paths | **Never** |
| Your keystrokes | **Never** |
| Your commit messages | **Never** |
| Your Git branches | **Never** |
| Your IP address | **Never stored** — used only for geolocation, then discarded |
| Your environment variables | **Never** |
| Your SSH keys or credentials | **Never** |

### Commit data

Commit data is **never read or sent by the extension** — no diffs, no insertions/deletions, no commit messages.

### Rate limiting

The server enforces rate-limiting on heartbeats to prevent abuse on coding time stats.

### Location

The extension determines your city from your IP address via an external geolocation service. Coordinates are **snapped to your city center** using a database of 152,000+ cities (GeoNames) — you appear at your city's canonical center on the globe, not at your address. If the city is not found in the database, coordinates are randomly offset within a 20 km radius. The location is cached for 1 hour.

**Your IP address is never transmitted to DevGlobe.**

### API key storage

Your API key is stored in your **OS system keychain** via SecretStorage (macOS Keychain, Windows Credential Manager, Linux libsecret) — never in plain text. The extension automatically migrates old keys that were stored in plain text in `settings.json` to the secure keychain.

### Network security

- **HTTPS only** (TLS 1.2+) — no HTTP fallback
- Heartbeats go directly to the database — no intermediary server
- The side panel uses a **Content Security Policy** with a cryptographic nonce
- Server-side, Row Level Security policies isolate each user's data

---

## Requirements

- VS Code **1.80+**
- **Zero external dependencies** — uses only native VS Code and Node.js APIs

---

## Links

- [devglobe.xyz](https://devglobe.xyz) — the globe
- [Source code](https://github.com/Nako0/devglobe-extension) — public GitHub repo

---

<p align="center">
  <a href="https://devglobe.xyz">devglobe.xyz</a>
</p>
