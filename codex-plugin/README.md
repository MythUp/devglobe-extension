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
1. Saves your key to `~/.devglobe/config.toml`
2. Installs heartbeat hooks in `~/.codex/hooks.json`
3. Enables the `codex_hooks` feature flag in `~/.codex/config.toml`

> After setup, restart Codex one more time for hooks to take effect.

Visibility settings (anonymous mode, repo sharing, profile mode) are managed on [devglobe.xyz/dashboard/settings](https://devglobe.xyz/dashboard/settings).

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
cat > ~/.devglobe/config.toml <<'EOF'
api_key = "YOUR_API_KEY"
EOF
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

Your coding session then appears live on the [DevGlobe map](https://devglobe.xyz) with the editor shown as `codex`.

> **Note:** Codex hooks require the `codex_hooks` feature flag (enabled automatically by `$devglobe setup`). This feature is marked as under development by OpenAI.

## Commands

| Command | Description |
|---------|-------------|
| `$devglobe setup YOUR_API_KEY` | Configure the skill with your API key and install hooks |
| `$devglobe status MESSAGE` | Set a status message on your DevGlobe profile |
| `$devglobe check` | Verify the installation (API key, hooks, feature flag) |
| `$devglobe uninstall` | Remove DevGlobe hooks from Codex |

## Privacy

The skill sends programming language, editor name, OS, coding time, the origin remote URL of your current git repo (when present), branch name, and the file path **relative to your repo root** — never an absolute home path.

Files outside any git repository are not tracked beyond their language. We never read source code, file contents, keystrokes, or commit messages.

Local privacy flags can be toggled in `~/.devglobe/config.toml` under `[privacy]`: `hide_file_names`, `hide_branch_names`, `hide_project_names` (the project flag also hides branches).

Globe-side visibility (anonymous mode, repo sharing on the live globe, profile mode) is managed on [devglobe.xyz/dashboard/settings](https://devglobe.xyz/dashboard/settings).

## Support

- Website: [devglobe.xyz](https://devglobe.xyz)
- Contact: [contact@devglobe.xyz](mailto:contact@devglobe.xyz)
- Issues: [GitHub Issues](https://github.com/Nako0/devglobe-extension/issues)
