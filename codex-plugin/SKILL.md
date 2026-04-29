---
name: devglobe
description: DevGlobe activity tracker - appear on the interactive developer globe while coding with Codex. Use $devglobe to setup your API key, set a status message, verify the install, or uninstall.
---

# DevGlobe for Codex

Track your coding activity on [devglobe.xyz](https://devglobe.xyz) — an interactive 3D globe showing developers coding in real-time.

Visibility settings (anonymous mode, repo sharing on the live globe, profile mode) are managed on [devglobe.xyz/dashboard/settings](https://devglobe.xyz/dashboard/settings).

Before running any command below, locate the installed skill directory:
```bash
DEVGLOBE_SKILL="$(find ~/.codex/skills -name SKILL.md \( -path '*devglobe*' -o -path '*codex-plugin*' \) 2>/dev/null | head -1 | xargs dirname)"
```

## Setup

### `$devglobe setup <API_KEY>`

Configure DevGlobe with your API key. Get your key at [devglobe.xyz](https://devglobe.xyz).

```bash
echo '{"api_key":"<API_KEY>"}' | node "$DEVGLOBE_SKILL/dist/setup.js"
```

This will:
1. Save your API key to `~/.devglobe/config.toml` (mode `0600`)
2. Install Codex hooks at `~/.codex/hooks.json` for automatic heartbeats
3. Enable the `codex_hooks` feature flag in `~/.codex/config.toml`

After setup, restart Codex for hooks to take effect.

## Status

### `$devglobe status <MESSAGE>`

Set a status message displayed on the globe next to your avatar.

```bash
API_KEY=$(awk -F'"' '/^api_key/ {print $2}' "$HOME/.devglobe/config.toml" 2>/dev/null)
echo "{\"api_key\":\"$API_KEY\",\"message\":\"<MESSAGE>\"}" | node "$DEVGLOBE_SKILL/dist/update-status.js"
```

## Diagnostics

### `$devglobe check`

Verify the installation is working:
```bash
echo "=== DevGlobe Status ==="
echo "Config: $(test -f ~/.devglobe/config.toml && echo OK || echo 'NOT SET')"
echo "API key set: $(awk -F'"' '/^api_key/ {print ($2 != "" ? "yes" : "no")}' ~/.devglobe/config.toml 2>/dev/null || echo 'NOT SET')"
echo "Hooks: $(grep -cE 'devglobe|codex-plugin' ~/.codex/hooks.json 2>/dev/null || echo 0) references in hooks.json"
echo "Feature flag: $(grep codex_hooks ~/.codex/config.toml 2>/dev/null || echo 'NOT SET')"
```

### `$devglobe uninstall`

Remove DevGlobe hooks from Codex:
```bash
echo '{}' | node "$DEVGLOBE_SKILL/dist/uninstall.js"
```
