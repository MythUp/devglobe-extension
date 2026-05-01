# DevGlobe — OpenCode Plugin

Track your OpenCode activity on the [DevGlobe](https://devglobe.xyz) world map.

## Prerequisites

- [OpenCode](https://github.com/anomalyco/opencode) installed
- A DevGlobe account (sign in at [devglobe.xyz](https://devglobe.xyz) with GitHub, X (Twitter), or Google)

## Install

Add `opencode-devglobe` to your `opencode.json`:

```json
{
  "plugin": ["opencode-devglobe"]
}
```

OpenCode installs the plugin automatically on startup via npm.

<details>
<summary>Alternative: install from a local clone</summary>

```bash
git clone https://github.com/Nako0/devglobe-extension
cd devglobe-extension/opencode-plugin
npm install && npm run build
```

Then in your `opencode.json`:

```json
{
  "plugin": ["file:///path/to/devglobe-extension/opencode-plugin/dist/index.js"]
}
```

</details>

## Setup

After installing, restart OpenCode and ask it to set up DevGlobe:

```
setup devglobe with my key devglobe_YOUR_KEY_HERE
```

Get your API key at [devglobe.xyz/dashboard/settings](https://devglobe.xyz/dashboard/settings).

OpenCode will call the `devglobe_setup` tool, which saves your key to `~/.devglobe/config.toml` (mode `0600`). Heartbeats start automatically while you code.

Visibility settings (anonymous mode, repo sharing on the live globe, profile mode) are managed on [devglobe.xyz/dashboard/settings](https://devglobe.xyz/dashboard/settings).

### Alternative: manual setup

```bash
mkdir -p ~/.devglobe
cat > ~/.devglobe/config.toml <<'EOF'
api_key = "YOUR_API_KEY"
EOF
```

Or use an environment variable (add to `~/.zshrc` or `~/.bashrc`):

```bash
export DEVGLOBE_API_KEY="your-api-key-here"
```

## Commands

The plugin registers tools that the AI agent can call on your behalf. Just ask in natural language:

| What you say | Tool called | Description |
|--------------|-------------|-------------|
| "setup devglobe with key X" | `devglobe_setup` | Configure your API key (writes to `~/.devglobe/config.toml`) |
| "set my devglobe status to Working on X" | `devglobe_status` | Set a status message on your globe profile |
| "check devglobe status" | `devglobe_check` | Verify installation (config, API key, privacy flags) |

## How it works

The plugin hooks into OpenCode's `tool.execute.after` and `file.edited` events to detect coding activity. It sends a heartbeat to DevGlobe at most once per minute via the shared `devglobe-core`. It automatically detects:

- The programming language from the files you interact with (exact file paths from tool calls)
- Your git repository (origin URL, branch, and the current file relative to the repo root)

Your coding session then appears live on the [DevGlobe map](https://devglobe.xyz/space) with the editor shown as `opencode`.

A forced heartbeat is sent when the session goes idle or is deleted, ensuring your last activity is always recorded.

## Updating

Since the plugin is installed from npm, OpenCode fetches the latest version automatically. To force an update, remove the cache:

```bash
rm -rf ~/.cache/opencode/node_modules/opencode-devglobe
```

Then restart OpenCode.

## Privacy

The plugin sends programming language, editor name, OS, coding time, the origin remote URL of your current git repo (when present), branch name, and the file path **relative to your repo root** — never an absolute home path.

Files outside any git repository are not tracked beyond their language. We never read source code, file contents, keystrokes, or commit messages.

Local privacy flags can be toggled in `~/.devglobe/config.toml` under `[privacy]`: `hide_file_names`, `hide_branch_names`, `hide_project_names` (the project flag also hides branches).

Globe-side visibility (anonymous mode, repo sharing on the live globe, profile mode) is managed on [devglobe.xyz/dashboard/settings](https://devglobe.xyz/dashboard/settings).

## Support

- Website: [devglobe.xyz](https://devglobe.xyz)
- Contact: [contact@devglobe.xyz](mailto:contact@devglobe.xyz)
- Issues: [GitHub Issues](https://github.com/Nako0/devglobe-extension/issues)
