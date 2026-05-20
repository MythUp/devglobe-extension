# DevGlobe — Zed Extension

[![devglobe-xyz/zed-devglobe](https://devglobe.app/api/badge/CaadriFR/repo/devglobe-xyz/zed-devglobe/coding-time.svg?theme=dark)](https://devglobe.app/plugins/zed)

Show up on a 3D globe in real time while you code, with automatic time tracking and coding metrics.

## Requirements

- [Zed](https://zed.dev) editor
- A DevGlobe API key from [devglobe.app/dashboard/settings](https://devglobe.app/dashboard/settings)

## Installation

1. In Zed, open the command palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Linux) → **zed: extensions**
2. Search **DevGlobe** → click **Install**

On first activation, the extension downloads the matching `devglobe-core` binary for your platform from [GitHub Releases](https://github.com/Nako0/devglobe-extension/releases) (one-time, ~60 MB).

## Setup

### 1. Get your API key

Sign in on [devglobe.app](https://devglobe.app) with GitHub, X (Twitter), or Google, then copy your API key from [profile settings](https://devglobe.app/dashboard/settings).

### 2. Configure DevGlobe

Create your config file:

```bash
mkdir -p ~/.devglobe
cat > ~/.devglobe/config.toml <<'EOF'
api_key = "devglobe_YOUR_KEY_HERE"
EOF
```

### 3. Trust your project

When you open a project, Zed may ask you to trust the worktree. Accept to allow DevGlobe to start.

### 4. Start coding

Open any code file and start editing. You'll appear on the globe within 30 seconds. The extension detects your language automatically.

## Manual install (for development)

To build from source (useful if you're contributing), you have two options:

**From this monorepo:**

```bash
git clone https://github.com/Nako0/devglobe-extension.git
```

In Zed: `Cmd+Shift+P` → **zed: install dev extension** → select the `zed-extension/` folder.

**From the standalone repo (what the marketplace uses):**

```bash
git clone https://github.com/devglobe-xyz/zed-devglobe.git
```

In Zed: `Cmd+Shift+P` → **zed: install dev extension** → select the `zed-devglobe/` folder.

## How it works

Zed loads DevGlobe as an extension that registers a small Language Server. The "server" never analyzes your code: it only receives file open, change and save events from Zed, and uses them to send heartbeats to DevGlobe every 30 seconds while you're actively coding. After 1 minute of inactivity, heartbeats pause automatically. After 10 minutes without activity, you disappear from the globe.

## Supported languages

80+ languages including: JavaScript, TypeScript, Python, Rust, Go, C, C++, Java, Kotlin, Swift, Ruby, PHP, Elixir, Haskell, Scala, and many more.

## Troubleshooting

If you don't appear on the globe or the extension misbehaves, enable verbose logging by adding to `~/.devglobe/config.toml`:

```toml
debug = true
```

All logs are written to `~/.devglobe/devglobe.log` (mode `0600`, auto-truncates to the last 1 MB when the file exceeds 5 MB).

## Privacy

The extension sends programming language, editor name, OS, coding time, the origin remote URL of your current git repo (when present), branch name, and the file path **relative to your repo root**, never an absolute home path.

Files outside any git repository are not tracked beyond their language. We never read source code, file contents, keystrokes, or commit messages.

Local privacy flags can be toggled in `~/.devglobe/config.toml` under `[privacy]`: `hide_file_names`, `hide_branch_names`, `hide_project_names` (the project flag also hides branches).

Globe-side visibility (anonymous mode, repo sharing, profile mode) is managed on [devglobe.app/dashboard/settings](https://devglobe.app/dashboard/settings).

See [PRIVACY.md](../PRIVACY.md) for full details.

## About this directory

This directory contains the in-monorepo mirror of the Zed extension. The standalone repository that powers the Zed marketplace listing lives at [devglobe-xyz/zed-devglobe](https://github.com/devglobe-xyz/zed-devglobe). Both are kept identical, so when bumping a version, update both.
