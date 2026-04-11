# DevGlobe — Codex CLI Skill

Track your Codex CLI activity on the [DevGlobe](https://devglobe.xyz) world map.

## Prerequisites

- [Codex CLI](https://github.com/openai/codex) installed
- [Node.js](https://nodejs.org) (v18+)
- A DevGlobe account (sign in at [devglobe.xyz](https://devglobe.xyz) with GitHub, X (Twitter), or Google)

## Install

In Codex, run:

```
$skill-installer --repo Nako0/devglobe-extension --path codex-plugin
```

That's it — Codex fetches the skill directly from GitHub.

After installing, **restart Codex** so the skill and its hooks are loaded.

<details>
<summary>Alternative: install from a local clone</summary>

```bash
git clone https://github.com/Nako0/devglobe-extension
```

```bash
mkdir -p ~/.codex/skills
ln -s "$(pwd)/devglobe-extension/codex-plugin" ~/.codex/skills/codex-plugin
```

Restart Codex after installing.

</details>

## Setup

Once restarted, configure the skill directly from Codex:

```
$devglobe setup YOUR_API_KEY
```

Get your API key at [devglobe.xyz](https://devglobe.xyz) — sign in, then open your **profile settings**.

This command:
1. Saves your key to `~/.devglobe/api_key`
2. Creates default settings in `~/.devglobe/config.json`
3. Installs heartbeat hooks in `~/.codex/hooks.json`
4. Enables the `codex_hooks` feature flag in `~/.codex/config.toml`

> After setup, restart Codex one more time for hooks to take effect.

### Settings

```
$devglobe anonymous true           # hide your exact location (default)
$devglobe anonymous false          # show your real city on the globe
$devglobe share-repo true          # display your repo name on the globe
$devglobe share-repo false         # hide your repo name (default)
```

| Setting | Default | Description |
|---------|---------|-------------|
| `anonymousMode` | `true` | Your marker is placed on a random city in your country (from 152,000+ cities). Your real location is never sent. |
| `shareRepo` | `false` | Display your current repo on your DevGlobe profile. |

Settings are stored in `~/.devglobe/config.json` and can also be edited manually.

### Status message

Display a custom status message on your DevGlobe profile:

```
$devglobe status Shipping features with Codex
```

Max 100 characters. Requires a valid API key — run `$devglobe setup` first.

### Alternative API key setup

If you prefer not to use `$devglobe setup`, you can set your key manually:

**Option A** — Environment variable (add to `~/.zshrc` or `~/.bashrc`):
```bash
export DEVGLOBE_API_KEY="your-api-key-here"
```

**Option B** — Config file:
```bash
mkdir -p ~/.devglobe
echo "your-api-key-here" > ~/.devglobe/api_key
```

Then manually enable Codex hooks:
```bash
cat > ~/.codex/config.toml << 'EOF'
[features]
codex_hooks = true
EOF
```

And copy the hooks template from `references/hooks-template.json` to `~/.codex/hooks.json`.

## How it works

The skill installs hooks on three Codex lifecycle events (`SessionStart`, `UserPromptSubmit`, `Stop`) and sends a heartbeat to DevGlobe at most once per minute. It automatically detects:

- The programming language from file paths mentioned in your prompts or recently modified files in your project
- Your git repository (from `git remote get-url origin`)
- Your approximate location (via IP geolocation, cached for 1 hour)

Your coding session then appears live on the [DevGlobe map](https://devglobe.xyz) with the editor shown as `codex`.

> **Note:** Codex hooks require the `codex_hooks` feature flag (enabled automatically by `$devglobe setup`). This feature is marked as under development by OpenAI.

## Commands

| Command | Description |
|---------|-------------|
| `$devglobe setup YOUR_API_KEY` | Configure the skill with your API key and install hooks |
| `$devglobe anonymous true/false` | Enable or disable anonymous mode |
| `$devglobe share-repo true/false` | Enable or disable repo sharing |
| `$devglobe status MESSAGE` | Set a status message on your DevGlobe profile |
| `$devglobe check` | Verify the installation (API key, hooks, feature flag) |
| `$devglobe uninstall` | Remove DevGlobe hooks from Codex |

## Privacy

| Data | Sent | Detail |
|------|------|--------|
| Programming language | Yes | Detected from file extensions mentioned in prompts or recently modified files. |
| Operating system | Yes | One of `macOS`, `Windows` or `Linux`. Displayed on your profile next to your coding stats. |
| Approximate location | Yes | Coordinates **snapped to your city center** (from a database of 152,000+ cities). |
| Repo name | **You decide** | `owner/repo` is **only sent to the server if `shareRepo` is enabled** (disabled by default). When disabled, your repo name never leaves your machine. |
| Anonymous mode | **You decide** | When enabled, real coordinates are replaced with a random city in your country. Your actual location is never transmitted. |
| Coding time | Yes | Accumulated per day, per language. |

The skill **never** reads your source code, file contents, file names, keystrokes, commit messages, environment variables, or credentials.

## Support

- Website: [devglobe.xyz](https://devglobe.xyz)
- Contact: [contact@devglobe.xyz](mailto:contact@devglobe.xyz)
- Issues: [GitHub Issues](https://github.com/Nako0/devglobe-extension/issues)
