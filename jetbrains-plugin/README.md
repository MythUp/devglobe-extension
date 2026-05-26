<h1 align="center">DevGlobe for JetBrains</h1>

<p align="center">
  <strong>Show up on a 3D globe in real time while you code.</strong><br/>
  Your activity is displayed live on <a href="https://devglobe.app">devglobe.app</a> — other developers see you, discover your projects and your links.
</p>

<p align="center">
  <a href="https://plugins.jetbrains.com/plugin/devglobe">JetBrains Marketplace</a> &nbsp;·&nbsp;
  <a href="https://devglobe.app">devglobe.app</a> &nbsp;·&nbsp;
  <a href="https://github.com/Nako0/devglobe-extension">Source code</a>
</p>

---

> **Open source & transparent** — This plugin is 100% open source. No code is read, no sensitive data is collected. You can audit every line on [GitHub](https://github.com/Nako0/devglobe-extension).

---

## Compatible IDEs

Compatible with **all JetBrains IDEs**: IntelliJ IDEA, WebStorm, PyCharm, GoLand, Rider, PhpStorm, CLion, RubyMine, DataGrip, Android Studio, RustRover.

---

## How it works

1. Sign in on [devglobe.app](https://devglobe.app) with GitHub, X (Twitter), or Google
2. Copy your API key from the site settings
3. Open the **DevGlobe** tool window in your IDE (right sidebar)
4. Paste your API key → **Connect**
5. You're online — your marker appears on the globe

The plugin sends a **heartbeat every 30 seconds** as long as you're actively coding. It pauses after 1 minute of inactivity. **After 10 minutes of inactivity, you disappear from the globe.**

Visibility settings (anonymous mode, repo sharing, profile mode) are managed on [devglobe.app/dashboard/settings](https://devglobe.app/dashboard/settings).

### Manual installation

You can also download the `.zip` from the [Releases](https://github.com/Nako0/devglobe-extension/releases) and install it via **Settings → Plugins → ⚙️ → Install Plugin from Disk**.

---

## Features

| Feature | Description |
|---------|-------------|
| **Live heartbeat** | Sends your activity every 30s. Auto-pauses after 1 min of inactivity. |
| **Language detection** | Uses JetBrains' native FileType system — supports all languages in your IDE without configuration. |
| **Platform detection** | Sends your OS (macOS, Windows or Linux) alongside each heartbeat so it appears on your profile. |
| **Git integration** | Detects your repo from the git remote. Commit data is never read or sent by the plugin. |
| **Status message** | Write what you're working on — visible on your globe profile. Persists in IDE settings. |
| **Status bar** | Displays your coding time for today (e.g. `⏱ 2h 15m`) in the IDE status bar. |
| **Notifications** | Native IDE notifications for every action (connection, tracking, status, errors). |

### Side panel

Two views in the DevGlobe tool window:

- **Login** — masked API key field + link to get your key on devglobe.app
- **Dashboard** — live coding time, active language, status message, start/stop buttons, logout

### Actions

Available under **Tools → DevGlobe** (and via _Find Action_ `⇧⌘A` / `Ctrl+Shift+A`):

| Action | Description |
|---|---|
| `Set Status Message` | Set your status message on the globe |
| `Show Coding Time` | Show your coding time today |
| `Open Panel` | Open the DevGlobe tool window |
| `Open Globe` | Open [devglobe.app/space](https://devglobe.app/space) in your browser |
| `Debug` | Toggle debug logging in `~/.devglobe/devglobe.log` |
| `Open Log File…` | Open `~/.devglobe/devglobe.log` |
| `Open Config File…` | Open `~/.devglobe/config.toml` |

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

## Privacy

The plugin sends programming language, editor name, OS, coding time, the origin remote URL of your current git repo (when present), branch name, and the file path **relative to your repo root** — never an absolute home path.

Files outside any git repository are not tracked beyond their language. We never read source code, file contents, keystrokes, or commit messages.

Local privacy flags can be toggled in `~/.devglobe/config.toml` under `[privacy]`: `hide_file_names`, `hide_branch_names`, `hide_project_names` (the project flag also hides branches).

Globe-side visibility (anonymous mode, repo sharing on the live globe, profile mode) is managed on [devglobe.app/dashboard/settings](https://devglobe.app/dashboard/settings).

API keys are stored in the IDE's native credential manager via PasswordSafe, backed by the OS keychain — never in plain text.

**Network:** HTTPS only (TLS 1.2+), no telemetry, no third-party trackers.

---

## Compatibility

- **IDE builds**: 242 — 263.* (2024.2 to 2026.3)
- **Java**: 17+

---

## Troubleshooting

If you don't appear on the globe or the plugin misbehaves, enable verbose logging by adding to `~/.devglobe/config.toml`:

```toml
debug = true
```

All logs are written to `~/.devglobe/devglobe.log` (mode `0600`, auto-truncates to the last 1 MB when the file exceeds 5 MB). The file is local and never sent anywhere.

| Level | When written |
|---|---|
| `ERROR` | Always — failed heartbeats, invalid API key, missing/broken config |
| `INFO` | Only when `debug = true` — API key saved, online/offline transitions, tracker init |
| `DEBUG` | Only when `debug = true` — heartbeat & status payloads, HTTP responses, rate-limit hits, file/repo changes |

Restart your IDE for the change to take effect. Set `debug = false` (or remove the line) to go back to errors-only. The `Debug` action under **Tools → DevGlobe** toggles it without editing the file.

---

## Links

- [devglobe.app/space](https://devglobe.app/space) — the globe
- [Source code](https://github.com/Nako0/devglobe-extension) — public GitHub repo

---

<p align="center">
  <a href="https://devglobe.app">devglobe.app</a>
</p>
