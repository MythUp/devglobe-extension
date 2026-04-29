---
name: setup
description: Configure DevGlobe plugin with your API key
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash
---

Configure the DevGlobe plugin. User arguments: $ARGUMENTS

## Rules

- The argument is the API key (a single string, no spaces)
- If no argument is provided, show an error with usage instructions

## Error case

If no API key is provided AND no key exists at `~/.devglobe/config.toml`:
- Usage: `/devglobe:setup YOUR_API_KEY`
- Get your API key at https://devglobe.xyz (profile settings)
- Contact: contact@devglobe.xyz

## Steps

1. Create `~/.devglobe/` directory if needed
2. Write the API key to `~/.devglobe/config.toml` as `api_key = "YOUR_API_KEY"` at the top of the file (preserve any existing `[privacy]` section)
3. Set the file mode to `0600`

## Output

Confirm the API key was saved. Mention they're now live on https://devglobe.xyz.
Mention `/devglobe:status MESSAGE` for setting a status message, and that visibility settings (anonymous mode, repo sharing) are managed at https://devglobe.xyz/dashboard/settings.
