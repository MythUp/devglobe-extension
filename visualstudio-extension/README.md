<h1 align="center">DevGlobe for Visual Studio</h1>

<p align="center">
  <strong>Show up on a 3D globe in real time while you code.</strong><br/>
  Your activity is displayed live on <a href="https://devglobe.app">devglobe.app</a> — other developers see you, discover your projects and your links.
</p>

<p align="center">
  <a href="https://github.com/Nako0/devglobe-extension/releases">Releases (.vsix)</a> &nbsp;·&nbsp;
  <a href="https://devglobe.app">devglobe.app</a> &nbsp;·&nbsp;
  <a href="https://github.com/Nako0/devglobe-extension">Source code</a>
</p>

---

> **Open source & transparent** — This extension is 100% open source. No code is read, no sensitive data is collected. You can audit every line on [GitHub](https://github.com/Nako0/devglobe-extension).

---

## How it works

1. Sign in on [devglobe.app](https://devglobe.app) with GitHub, X (Twitter), or Google
2. Copy your API key from the site settings
3. Open the **DevGlobe** panel — click the **globe button** in the toolbar, or **View → Other Windows → DevGlobe**
4. Paste your API key → **Connect**
5. You're online — your marker appears on the globe

The extension sends a **heartbeat every 30 seconds** as long as you're actively coding. It pauses after 1 minute of inactivity. **After 15 minutes of inactivity, you disappear from the globe.**

On first launch, the extension downloads the matching `devglobe-core` binary for Windows from [GitHub Releases](https://github.com/Nako0/devglobe-extension/releases) (one-time) and caches it under `%LOCALAPPDATA%\DevGlobe\core`.

Visibility settings (anonymous mode, repo sharing, profile mode) are managed on [devglobe.app/dashboard/settings](https://devglobe.app/dashboard/settings).

---

## Features

| Feature | Description |
|---------|-------------|
| **Live heartbeat** | Sends your activity every 30s. Auto-pauses after 1 min of inactivity. |
| **Language detection** | Detects 150+ languages from your active editor document. |
| **Platform detection** | Sends your OS (Windows) alongside each heartbeat so it appears on your profile. |
| **Git integration** | Detects your repo from the git remote. Commit data is never read or sent by the extension. |
| **Status message** | Write what you're working on — visible on your globe profile. |
| **Status bar** | Displays your coding time for today (e.g. `2h 15m`) in the Visual Studio status bar. |

### Tool window

Two views in the DevGlobe tool window:

- **Login** — masked API key field + link to get your key on devglobe.app
- **Dashboard** — live coding time, active language, status message, start/stop buttons, disconnect

### Commands

Accessible from **Tools → DevGlobe**:

| Command | Description |
|---------|-------------|
| `Set Status Message` | Set your status message on the globe |
| `Show Coding Time` | Show your coding time today |
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

The extension sends programming language, editor name, OS, coding time, the origin remote URL of your current git repo (when present), branch name, and the file path **relative to your repo root** — never an absolute home path.

Files outside any git repository are not tracked beyond their language. We never read source code, file contents, keystrokes, or commit messages.

Local privacy flags can be toggled in `~/.devglobe/config.toml` under `[privacy]`: `hide_file_names`, `hide_branch_names`, `hide_project_names` (the project flag also hides branches).

Globe-side visibility (anonymous mode, repo sharing on the live globe, profile mode) is managed on [devglobe.app/dashboard/settings](https://devglobe.app/dashboard/settings).

API keys are stored in the Windows Credential Manager — never in plain text. The core reads the key from `%USERPROFILE%\.devglobe\config.toml` (created with restrictive permissions).

**Network:** HTTPS only (TLS 1.2+), no telemetry, no third-party trackers.

---

## Requirements

- **Visual Studio 2022 (17.x)** or **Visual Studio 2026 (18.x)** on Windows
- Not to be confused with **VS Code** — see the [DevGlobe for VS Code](https://marketplace.visualstudio.com/items?itemName=devglobe.devglobe) extension for that editor

---

## Links

- [devglobe.app/space](https://devglobe.app/space) — the globe
- [Source code](https://github.com/Nako0/devglobe-extension) — public GitHub repo

---

<p align="center">
  <a href="https://devglobe.app">devglobe.app</a>
</p>
