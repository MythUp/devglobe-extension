---
name: setup
description: Configure DevGlobe plugin with your API key
user-invocable: true
allowed-tools:
  - Bash
---

Configure the DevGlobe plugin. User arguments: $ARGUMENTS

## Rules

- The argument is the API key (a single string, no spaces)
- If no argument is provided, show usage instructions and exit

## Error case

If no API key is provided:
- Usage: `/devglobe:setup YOUR_API_KEY`
- Get your API key at https://devglobe.app (profile settings)
- Contact: contact@devglobe.app

## Steps

Pipe the API key into the bundled setup script:

```bash
echo '{"api_key":"<API_KEY>"}' | node "${CLAUDE_PLUGIN_ROOT}/dist/setup.js"
```

The script writes `api_key = "..."` to `~/.devglobe/config.toml` (mode `0600`), preserving any `[privacy]` section already present.

## Output

Confirm the API key was saved. Mention they're now live on https://devglobe.app.
Mention `/devglobe:status MESSAGE` for setting a status message, and that visibility settings (anonymous mode, repo sharing, profile mode) are managed at https://devglobe.app/dashboard/settings.
