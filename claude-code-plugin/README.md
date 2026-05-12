# DevGlobe — Claude Code Plugin

Track your Claude Code activity on the [DevGlobe](https://devglobe.app) world map.

## Prerequisites

- [Claude Code](https://claude.com/claude-code) installed
- [Node.js](https://nodejs.org) (v18+)
- A DevGlobe account (sign in at [devglobe.app](https://devglobe.app) with GitHub, X (Twitter), or Google)

## Install

In Claude Code, run:

```
/plugin marketplace add Nako0/devglobe-extension
```

```
/plugin install devglobe@devglobe
```

That's it — Claude Code fetches the plugin directly from GitHub.

After installing, **restart Claude Code** so the plugin and its commands are loaded:

```
/exit
```

Then reopen Claude Code.

<details>
<summary>Alternative: install from a local clone</summary>

```bash
git clone https://github.com/Nako0/devglobe-extension
```

Then in Claude Code:

```
/plugin marketplace add ./devglobe-extension
```
```
/plugin install devglobe@devglobe
```

Restart Claude Code after installing (`/exit`, then reopen).

</details>

## Setup

Once restarted, configure the plugin directly from Claude Code:

```
/devglobe:setup YOUR_API_KEY
```

Get your API key at [devglobe.app](https://devglobe.app) — sign in, then open your **profile settings**.

This command saves your key to `~/.devglobe/config.toml`.

> If no API key is provided, the command shows an error with instructions.

Visibility settings (anonymous mode, repo sharing, profile mode) are managed on [devglobe.app/dashboard/settings](https://devglobe.app/dashboard/settings).

### Status message

Display a custom status message on your DevGlobe profile:

```
/devglobe:status Shipping features with Claude
```

Max 100 characters. Requires a valid API key — run `/devglobe:setup` first.

### Alternative API key setup

If you prefer not to use `/devglobe:setup`, you can set your key manually:

**Option A** — Environment variable (add to `~/.zshrc` or `~/.bashrc`):
```bash
export DEVGLOBE_API_KEY="your-api-key-here"
```

**Option B** — Config file:
```bash
mkdir -p ~/.devglobe
cat > ~/.devglobe/config.toml <<'EOF'
api_key = "YOUR_API_KEY"
EOF
```

## How it works

The plugin hooks into Claude Code events (`PostToolUse`, `UserPromptSubmit`, `Stop`) and sends a heartbeat to DevGlobe at most once per minute. It automatically detects:

- The programming language from the files you interact with
- Your git repository (from `git remote get-url origin`)

Your coding session then appears live on the [DevGlobe map](https://devglobe.app) with the editor shown as `claude-code`.

## Commands

| Command | Description |
|---------|-------------|
| `/devglobe:setup YOUR_API_KEY` | Configure the plugin with your API key |
| `/devglobe:status MESSAGE` | Set a status message on your DevGlobe profile |

## Privacy

The plugin sends programming language, editor name, OS, coding time, the origin remote URL of your current git repo (when present), branch name, and the file path **relative to your repo root** — never an absolute home path.

Files outside any git repository are not tracked beyond their language. We never read source code, file contents, keystrokes, or commit messages.

Local privacy flags can be toggled in `~/.devglobe/config.toml` under `[privacy]`: `hide_file_names`, `hide_branch_names`, `hide_project_names` (the project flag also hides branches).

Globe-side visibility (anonymous mode, repo sharing on the live globe, profile mode) is managed on [devglobe.app/dashboard/settings](https://devglobe.app/dashboard/settings).

## Support

- Website: [devglobe.app](https://devglobe.app)
- Contact: [contact@devglobe.app](mailto:contact@devglobe.app)
- Issues: [GitHub Issues](https://github.com/Nako0/devglobe-extension/issues)
