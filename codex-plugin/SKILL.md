---
name: devglobe
description: DevGlobe activity tracker - appear on the interactive developer globe while coding with Codex. Use $devglobe to setup your API key, configure settings, or update your status message.
---

# DevGlobe for Codex

Track your coding activity on [devglobe.xyz](https://devglobe.xyz) — an interactive 3D globe showing developers coding in real-time.

Before running any command below, locate the installed skill directory:
```bash
DEVGLOBE_SKILL="$(find ~/.codex/skills -name SKILL.md -path '*/devglobe*' -o -name SKILL.md -path '*/codex-plugin*' 2>/dev/null | head -1 | xargs dirname)"
```

## Setup

### `$devglobe setup <API_KEY>`

Configure DevGlobe with your API key. Get your key at [devglobe.xyz](https://devglobe.xyz).

```bash
echo '{"api_key":"<API_KEY>"}' | "$DEVGLOBE_SKILL/scripts/setup"
```

This will:
1. Save your API key to `~/.devglobe/api_key`
2. Create default config at `~/.devglobe/config.json`
3. Install Codex hooks at `~/.codex/hooks.json` for automatic heartbeats
4. Enable `codex_hooks` feature flag in `~/.codex/config.toml`

After setup, restart Codex for hooks to take effect.

## Configuration

### `$devglobe anonymous <true|false>`

Toggle anonymous mode. When enabled (default), your location is snapped to a random city center in your country instead of your exact IP location.

```bash
node -e "
const fs = require('fs'), p = require('os').homedir() + '/.devglobe/config.json';
const c = JSON.parse(fs.readFileSync(p, 'utf-8'));
c.anonymousMode = <true|false>;
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('anonymousMode set to', c.anonymousMode);
"
```

### `$devglobe share-repo <true|false>`

Toggle repository sharing. When enabled, the repository you're working on is visible on the globe.

```bash
node -e "
const fs = require('fs'), p = require('os').homedir() + '/.devglobe/config.json';
const c = JSON.parse(fs.readFileSync(p, 'utf-8'));
c.shareRepo = <true|false>;
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('shareRepo set to', c.shareRepo);
"
```

### `$devglobe status <MESSAGE>`

Set a status message displayed on the globe next to your avatar.

```bash
API_KEY=$(cat "$HOME/.devglobe/api_key" 2>/dev/null)
echo "{\"api_key\":\"$API_KEY\",\"message\":\"<MESSAGE>\"}" | "$DEVGLOBE_SKILL/scripts/update-status"
```

## Diagnostics

### `$devglobe check`

Verify the installation is working:
```bash
echo "=== DevGlobe Status ==="
echo "API key: $(cat ~/.devglobe/api_key 2>/dev/null | head -c 15 && echo '... OK' || echo 'NOT SET')"
echo "Config: $(cat ~/.devglobe/config.json 2>/dev/null || echo 'NOT SET')"
echo "Hooks: $(grep -c devglobe ~/.codex/hooks.json 2>/dev/null || echo 0) references in hooks.json"
echo "Feature flag: $(grep codex_hooks ~/.codex/config.toml 2>/dev/null || echo 'NOT SET')"
```

### `$devglobe uninstall`

Remove DevGlobe hooks from Codex:
```bash
echo '{}' | "$DEVGLOBE_SKILL/scripts/uninstall"
```
