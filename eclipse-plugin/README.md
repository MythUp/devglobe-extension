# DevGlobe Eclipse Plugin

Track your coding activity on a live 3D globe at [devglobe.app](https://devglobe.app).

## Features

- **Automatic coding time tracking** — monitors active editor files and sends activity to the DevGlobe core
- **Sidebar view** — shows coding time, current language, and status in the DevGlobe panel
- **Status bar** — displays today's coding time in the Eclipse status bar
- **Toast notifications** — shows DevGlobe events in the Eclipse status line (auto-clear after 5 s)
- **Status messages** — set custom status messages visible on your globe (supports empty to clear)
- **Toolbar icon** — globe icon in the right vertical toolbar to open the DevGlobe view
- **Menu integration** — DevGlobe menu with all commands
- **Debug mode** — toggle debug logging for troubleshooting

## Installation

### From Update Site (recommended)

1. In Eclipse, go to **Help → Install New Software…**
2. Add the DevGlobe update site URL
3. Select "DevGlobe" and follow the installation wizard
4. Restart Eclipse

### From JAR

1. Download the plugin JAR
2. Place it in your Eclipse `dropins/` directory
3. Restart Eclipse

## Setup

1. Open the **DevGlobe** view: **Window → Show View → Other… → DevGlobe → DevGlobe**
2. Enter your API key from [devglobe.app/settings](https://devglobe.app/settings)
3. Click **Connect** — tracking starts automatically

## Building

### Prerequisites

- **Java 21+** (required by the plugin)
- **Maven 3.8+** (with Tycho 4.x support)
- **Eclipse IDE for RCP and RAP Developers 2024-06+** (for target platform & PDE)
- **Node.js 18+** (only needed to rebuild `devglobe-core` from source)

### 1. Build devglobe-core (optional — binary is auto-downloaded)

The plugin downloads the `devglobe-core` binary from GitHub releases at runtime.
If you want to build it from source instead:

```bash
cd devglobe-core
npm install
npm run build
```

The bundled output is `devglobe-core/dist/devglobe-core.js`.

### 2. Build the Eclipse plugin

```bash
cd eclipse-plugin
mvn clean verify
```

The built plugin JAR will be in `target/`.

### 3. Import into Eclipse (for development)

1. Open Eclipse IDE for RCP and RAP Developers
2. **File → Import… → General → Existing Projects into Workspace**
3. Select the `eclipse-plugin/` directory
4. Click **Finish**
5. Right-click the project → **Run As → Eclipse Application**

## Architecture

```
eclipse-plugin/
├── META-INF/MANIFEST.MF          # OSGi bundle manifest
├── plugin.xml                    # Eclipse extension points
├── build.properties              # Build configuration
├── pom.xml                       # Maven Tycho build
├── icons/                        # Plugin icons
└── src/main/java/xyz/devglobe/eclipse/
    ├── core/
    │   ├── DevGlobePlugin.java       # Bundle activator
    │   ├── DevGlobeStartup.java      # Early startup (IStartup)
    │   ├── DevGlobeTracker.java      # Central tracker orchestrator
    │   ├── CoreClient.java           # JSON-line IPC to devglobe-core
    │   ├── CoreDownloader.java       # Downloads devglobe-core binary
    │   ├── TrackerState.java         # Immutable state data class
    │   └── LanguageService.java      # File extension → language mapping
    ├── auth/
    │   └── ConfigWriter.java         # Spawns devglobe-core setup subprocess
    ├── ui/
    │   ├── DevGlobeView.java             # Sidebar ViewPart (login + dashboard)
    │   ├── DevGlobeStatusBarContribution.java  # Status bar widget
    │   ├── DocumentTracker.java          # Editor activity listener
    │   └── Notifier.java                 # Toast notifications via status line
    └── actions/
        ├── SetStatusHandler.java      # Set status command
        ├── ShowCodingTimeHandler.java # Show coding time command
        ├── OpenGlobeHandler.java      # Open globe in browser
        ├── OpenDevGlobeViewHandler.java # Open DevGlobe view (toolbar icon)
        ├── ToggleDebugHandler.java    # Toggle debug mode
        ├── OpenLogFileHandler.java    # Open log file
        └── OpenConfigFileHandler.java # Open config file
```

## IPC Protocol

The plugin communicates with `devglobe-core` via a JSON-line protocol over stdin/stdout.
The `devglobe-core` binary is auto-downloaded from GitHub releases to
`~/.devglobe/bin/devglobe-core-<version>[.exe]`.

- **init** — sends plugin version and editor name
- **activity** — sends file path (language detection delegated to devglobe-core)
- **set_status** — sends a status message (empty string clears status)
- **pause/resume** — pauses/resumes tracking
- **shutdown** — gracefully stops the core process

Events received from devglobe-core:

- **ready** — core process is initialised
- **online** / **offline** — API server reachability
- **heartbeat_ok** — heartbeat succeeded
- **not_configured** / **invalid_api_key** — auth issues
- **status_ok** / **status_error** — status update result

## License

See [LICENSE](../LICENSE) in the repository root.
