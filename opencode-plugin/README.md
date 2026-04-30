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

Get your API key at [devglobe.xyz](https://devglobe.xyz) — sign in, then open your **profile settings**.

OpenCode will call the `devglobe_setup` tool, which saves your key and creates default settings. Heartbeats start automatically while you code.

### Alternative: manual setup

```bash
mkdir -p ~/.devglobe
echo "your-api-key-here" > ~/.devglobe/api_key
echo '{"anonymousMode": true, "shareRepo": false}' > ~/.devglobe/config.json
```

Or use an environment variable (add to `~/.zshrc` or `~/.bashrc`):

```bash
export DEVGLOBE_API_KEY="your-api-key-here"
```

## Commands

The plugin registers tools that the AI agent can call on your behalf. Just ask in natural language:

| What you say | Tool called | Description |
|--------------|-------------|-------------|
| "setup devglobe with key X" | `devglobe_setup` | Configure your API key and create default settings |
| "enable anonymous mode on devglobe" | `devglobe_anonymous` | Toggle anonymous mode (city-level location) |
| "share my repo on devglobe" | `devglobe_share_repo` | Toggle repository sharing on the globe |
| "set my devglobe status to Working on X" | `devglobe_status` | Set a status message on your globe profile |
| "check devglobe status" | `devglobe_check` | Verify installation (API key, config) |

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `anonymousMode` | `true` | Your marker is placed on a random city in your country (from 152,000+ cities). Your real location is never sent. |
| `shareRepo` | `false` | Display your current repo on your DevGlobe profile. |

Settings are stored in `~/.devglobe/config.json` and can also be modified via the tools above.

## How it works

The plugin hooks into OpenCode's `tool.execute.after` and `file.edited` events to detect coding activity. It sends a heartbeat to DevGlobe at most once per minute via devglobe-core. It automatically detects:

- The programming language from the files you interact with (exact file paths from tool calls)
- Your git repository (from `git remote get-url origin`)
- Your approximate location (via IP geolocation, cached for 1 hour)

Your coding session then appears live on the [DevGlobe map](https://devglobe.xyz) with the editor shown as `opencode`.

A forced heartbeat is sent when the session goes idle or is deleted, ensuring your last activity is always recorded.

## Updating

Since the plugin is installed from npm, OpenCode fetches the latest version automatically. To force an update, remove the cache:

```bash
rm -rf ~/.cache/opencode/node_modules/opencode-devglobe
```

Then restart OpenCode.

## Privacy

| Data | Sent | Detail |
|------|------|--------|
| Programming language | Yes | Detected from file extensions of files being edited. |
| Operating system | Yes | One of `macOS`, `Windows` or `Linux`. Displayed on your profile next to your coding stats. |
| Approximate location | Yes | Coordinates **snapped to your city center** (from a database of 152,000+ cities). |
| Repo name | **You decide** | `owner/repo` is **only sent to the server if `shareRepo` is enabled** (disabled by default). When disabled, your repo name never leaves your machine. |
| Anonymous mode | **You decide** | When enabled, real coordinates are replaced with a random city in your country (from a database of 152,000+ cities worldwide). Your actual location is never transmitted. |
| Coding time | Yes | Accumulated per day, per language. |

The plugin **never** reads your source code, file contents, file names, keystrokes, commit messages, environment variables, or credentials.

## Support

- Website: [devglobe.xyz](https://devglobe.xyz)
- Contact: [contact@devglobe.xyz](mailto:contact@devglobe.xyz)
- Issues: [GitHub Issues](https://github.com/Nako0/devglobe-extension/issues)
