# DevGlobe Godot Engine Plugin

Track your coding time in Godot Engine with [DevGlobe](https://devglobe.app).

## Features

- **Automatic time tracking** — Tracks your coding activity in the Godot script editor
- **Thin daemon wrapper** — Delegates ALL logic (heartbeats, dedup, git detection, language mapping, offline resilience, privacy) to `devglobe-core` via stdin/stdout JSON protocol
- **Privacy controls** — Hide file names, branch names, or project names from heartbeats
- **Pause/Resume** — Pause tracking when you're away

## Requirements

- **Godot 4.x** (tested with 4.2+)
- **Node.js 18+** — Required to run `devglobe-core`
- **devglobe-core** — Build from source (see below)

> **Important:** This plugin is a thin wrapper around `devglobe-core`. It does NOT reimplement any tracking logic. All heartbeats, deduplication, git detection, language mapping, and offline resilience are handled by the `devglobe-core` daemon.

## Installation

1. Build and install `devglobe-core` from source:
   ```bash
   cd devglobe-core/          # from the repo root
   npm install
   npm run build
   npm link                  # creates global symlink
   ```
   This creates a global `devglobe-core` command. Verify with:
   ```bash
   devglobe-core --version
   ```

2. Copy the `godot-engine-plugin/` directory into your project's `addons/` folder:
   ```
   your_project/
   └── addons/
       └── devglobe/
           ├── plugin.cfg
           ├── devglobe_plugin.gd
           ├── daemon_process.gd
           ├── config_manager.gd
           ├── settings_dialog.gd
           └── tcp-bridge.js
   ```

3. In Godot, go to **Project → Project Settings → Plugins** and enable **DevGlobe**.

4. Click the **DevGlobe** button in the toolbar to enter your API key.

## Configuration

The plugin reads `~/.devglobe/config.toml` (shared with all DevGlobe plugins) for UI display. The canonical way to set your API key is via the settings dialog or the CLI:

```bash
devglobe-core setup your-api-key-here
```

Config file format (`~/.devglobe/config.toml`):

```toml
api_key = "your-api-key-here"
debug = false

[privacy]
hide_file_names = false
hide_branch_names = false
hide_project_names = false
```

### Privacy Options

| Option | Effect |
|--------|--------|
| `hide_file_names` | Strips file paths from heartbeats |
| `hide_branch_names` | Hides the Git branch name |
| `hide_project_names` | Hides the repository URL and branch |

## Architecture

The plugin is a **thin daemon wrapper** — it spawns `devglobe-core daemon` as a subprocess and communicates via JSON over stdin/stdout. All business logic lives in `devglobe-core`.

```
┌─────────────────────────────────────────────────┐
│  Godot Engine (EditorPlugin)                    │
│                                                 │
│  devglobe_plugin.gd                             │
│   ├── Captures script changes                   │
│   ├── Sends activity to daemon                  │
│   └── Updates toolbar UI                        │
│       └── settings_dialog.gd — Settings UI      │
│       └── config_manager.gd — Reads config.toml │
│                                                 │
│  daemon_process.gd                              │
│   └── Spawns tcp-bridge.js, connects via TCP   │
└──────────────┬──────────────────────────────────┘
               │ TCP socket (127.0.0.1:PORT)
┌──────────────▼──────────────────────────────────┐
│  tcp-bridge.js (Node.js)                        │
│   └── Forwards JSON between TCP and daemon     │
│       stdin/stdout                              │
└──────────────┬──────────────────────────────────┘
               │ stdin/stdout JSON
┌──────────────▼──────────────────────────────────┐
│  devglobe-core daemon (Node.js subprocess)      │
│                                                 │
│  Handles: heartbeats, dedup, git detection,     │
│  language mapping, offline resilience, privacy  │
└─────────────────────────────────────────────────┘
```

### Daemon Protocol

**Client → Core (stdin):**
| Message | Payload | Description |
|---------|---------|-------------|
| `init` | `{plugin_version, editor}` | Initialize daemon |
| `activity` | `{file, language}` | Report file activity |
| `set_status` | `{message}` | Set status message |
| `pause` | `{}` | Pause tracking |
| `resume` | `{}` | Resume tracking |
| `shutdown` | `{}` | Graceful shutdown |

**Core → Client (stdout):**
| Event | Payload | Description |
|-------|---------|-------------|
| `ready` | `{configured}` | Daemon ready |
| `not_configured` | `{}` | No API key set |
| `invalid_api_key` | `{}` | API key rejected |
| `heartbeat_ok` | `{today_seconds, language}` | Heartbeat accepted |
| `offline` | `{}` | Connection lost |
| `online` | `{}` | Connection restored |
| `status_ok` | `{}` | Status updated |
| `status_error` | `{error}` | Status update failed |

## Editor Name

The plugin identifies itself as `"godot"` in heartbeat payloads (matching DevGlobe's editor naming convention).

## License

See the [LICENSE](../LICENSE) file in the repository root.
