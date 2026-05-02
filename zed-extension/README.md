# DevGlobe — Zed Extension

Show your live coding presence on the [DevGlobe](https://devglobe.xyz) world map from Zed.

> **Note:** This extension is pending review for the Zed marketplace ([PR #5841](https://github.com/zed-industries/extensions/pull/5841)). In the meantime, you can install it manually as a dev extension.

## Requirements

- [Zed](https://zed.dev) editor
- [Node.js](https://nodejs.org) 18 or later
- A DevGlobe API key from [devglobe.xyz/dashboard/settings](https://devglobe.xyz/dashboard/settings)

## Installation

### Option A: From the standalone repo (no build required)

```bash
git clone https://github.com/devglobe-xyz/zed-devglobe.git
```

Then in Zed: `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Linux) → "zed: install dev extension" → select the `zed-devglobe/` folder.

### Option B: From the main DevGlobe repo (requires build)

```bash
git clone https://github.com/Nako0/devglobe-extension.git
cd devglobe-extension/devglobe-core && npm install && npm run build
cd ../zed-extension/server && npm install && npm run build
```

Then in Zed: `Cmd+Shift+P` → "zed: install dev extension" → select the `zed-extension/` folder.

## Setup

### 1. Get your API key

Sign in on [devglobe.xyz](https://devglobe.xyz) with GitHub, X (Twitter), or Google, then copy your API key from [profile settings](https://devglobe.xyz/dashboard/settings).

### 2. Configure DevGlobe

Run the setup command from your terminal:

```bash
node /path/to/zed-devglobe/server/dist/server.js setup devglobe_YOUR_KEY_HERE
```

This writes your key to `~/.devglobe/config.toml` (mode `0600`).

Or create the file manually:

```bash
mkdir -p ~/.devglobe
cat > ~/.devglobe/config.toml <<'EOF'
api_key = "devglobe_YOUR_KEY_HERE"
EOF
```

Visibility settings (anonymous mode, repo sharing on the live globe, profile mode) are managed on [devglobe.xyz/dashboard/settings](https://devglobe.xyz/dashboard/settings).

### 3. Trust your project

When you open a project, Zed may ask you to trust the worktree. Accept to allow the DevGlobe language server to start.

### 4. Start coding

Open any code file and start editing. You'll appear on the globe within 30 seconds. The extension detects your language automatically.

### Update status message

```bash
node /path/to/server/dist/server.js status "Working on my project"
node /path/to/server/dist/server.js status ""  # clear
```

## How it works

The extension runs a lightweight Language Server (LSP) that receives file open/change/save events from Zed. It uses DevGlobe's shared core to send heartbeats every 30 seconds while you're actively coding. After 1 minute of inactivity, heartbeats pause automatically.

## Supported languages

80+ languages including: JavaScript, TypeScript, Python, Rust, Go, C, C++, Java, Kotlin, Swift, Ruby, PHP, Elixir, Haskell, Scala, and many more.

## Privacy

The extension sends programming language, editor name, OS, coding time, the origin remote URL of your current git repo (when present), branch name, and the file path **relative to your repo root** — never an absolute home path.

Files outside any git repository are not tracked beyond their language. We never read source code, file contents, keystrokes, or commit messages.

Local privacy flags can be toggled in `~/.devglobe/config.toml` under `[privacy]`: `hide_file_names`, `hide_branch_names`, `hide_project_names` (the project flag also hides branches).

Globe-side visibility (anonymous mode, repo sharing on the live globe, profile mode) is managed on [devglobe.xyz/dashboard/settings](https://devglobe.xyz/dashboard/settings).

See [PRIVACY.md](../PRIVACY.md) for full details.
