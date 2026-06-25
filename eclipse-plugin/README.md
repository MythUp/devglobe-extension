<h1 align="center">DevGlobe for Eclipse</h1>

<p align="center">
  <strong>Show up on a 3D globe in real time while you code.</strong><br/>
  Your activity is displayed live on <a href="https://devglobe.app">devglobe.app</a> — other developers see you, discover your projects and your links.
</p>

<p align="center">
  <a href="https://devglobe.app">devglobe.app</a> &nbsp;·&nbsp;
  <a href="https://github.com/Nako0/devglobe-extension">Source code</a>
</p>

---

> **Open source & transparent** — This plugin is 100% open source. No code is read, no sensitive data is collected. You can audit every line on [GitHub](https://github.com/Nako0/devglobe-extension).

---

## How it works

1. Sign in on [devglobe.app](https://devglobe.app) with GitHub, X (Twitter), or Google
2. Copy your API key from the site settings
3. Open the **DevGlobe** view: **Window → Show View → Other… → DevGlobe → DevGlobe**
4. Paste your API key → **Connect**
5. You're online — your marker appears on the globe

The plugin sends a **heartbeat every 30 seconds** as long as you're actively coding. It pauses after 1 minute of inactivity. **After 15 minutes of inactivity, you disappear from the globe.**

Visibility settings (anonymous mode, repo sharing, profile mode) are managed on [devglobe.app/dashboard/settings](https://devglobe.app/dashboard/settings).

---

## Features

| Feature | Description |
|---------|-------------|
| **Live heartbeat** | Sends your activity every 30s. Auto-pauses after 1 min of inactivity. |
| **Language detection** | Detects 150+ languages from your active editor tab. |
| **Platform detection** | Sends your OS (macOS, Windows or Linux) alongside each heartbeat so it appears on your profile. |
| **Git integration** | Detects your repo from the git remote. Commit data is never read or sent by the plugin. |
| **Status message** | Write what you're working on — visible on your globe profile. Supports empty to clear. |
| **Notifications** | Toast notifications in the Eclipse status line for connection events, errors, and status changes. |

### Sidebar

Two views in the DevGlobe panel:

- **Login** — masked API key field + link to get your key on devglobe.app
- **Dashboard** — live coding time, active language, status message, start/stop buttons, logout

### Commands

Available under **DevGlobe** in the menu bar:

| Command | Description |
|---------|-------------|
| `Set Status Message` | Set your status message on the globe |
| `Show Coding Time` | Show your coding time today |
| `Open Globe` | Open [devglobe.app/space](https://devglobe.app/space) in your browser |
| `Toggle Debug Mode` | Toggle debug logging in `~/.devglobe/devglobe.log` |
| `Open Log File…` | Open `~/.devglobe/devglobe.log` |
| `Open Config File…` | Open `~/.devglobe/config.toml` |

---

## Installation

### From Update Site (recommended)

1. In Eclipse, go to **Help → Install New Software…**
2. Add the DevGlobe update site URL
3. Select "DevGlobe" and follow the installation wizard
4. Restart Eclipse

### From JAR

1. Download the plugin JAR from the [Releases](https://github.com/Nako0/devglobe-extension/releases)
2. Place it in your Eclipse `dropins/` directory
3. Restart Eclipse

---

## Developer Setup

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **JDK** | 21+ | Required — the plugin uses `JavaSE-21` execution environment |
| **Maven** | 3.8+ | With Tycho 4.x support (tested with 3.9.6) |
| **Eclipse IDE for RCP and RAP Developers** | 2024-06+ | Provides PDE, Target Platform, and OSGi tooling |
| **Node.js** | 18+ | Only needed to rebuild `devglobe-core` from source |

> **JDK 21 is mandatory.** The OSGi manifest declares `Bundle-RequiredExecutionEnvironment: JavaSE-21`. Earlier JDK versions will cause compilation and runtime failures.

### Build devglobe-core (optional — binary is auto-downloaded)

The plugin downloads the `devglobe-core` binary from GitHub releases at runtime.
If you want to build it from source instead:

```bash
cd devglobe-core
npm install
npm run build
```

The bundled output is `devglobe-core/dist/devglobe-core.js`.

### Compile the plugin

```bash
cd eclipse-plugin
mvn clean verify
```

The built plugin JAR will be in `target/`.

> **Windows users:** Make sure `JAVA_HOME` points to JDK 21 before running Maven:
> ```powershell
> $env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
> cd eclipse-plugin
> mvn clean verify
> ```

### Import into Eclipse IDE for RCP and RAP Developers

1. Open **Eclipse IDE for RCP and RAP Developers** (2024-06 or later)
2. Go to **File → Import… → General → Existing Projects into Workspace**
3. Select the `eclipse-plugin/` directory as root
4. Make sure the project is checked, then click **Finish**
5. The project should appear in the **Package Explorer** with the plug-in icon

> If Eclipse reports target-platform errors, open the plugin project's target platform definition and resolve it (**Right-click → Set as Target Platform**).

### Test the plugin in Eclipse

1. Right-click the project in the **Package Explorer**
2. Select **Run As → Eclipse Application**
3. A new Eclipse instance launches with the DevGlobe plugin loaded
4. Open the DevGlobe view: **Window → Show View → Other… → DevGlobe → DevGlobe**
5. Enter your API key and click **Connect** to verify everything works

> The **Run As → Eclipse Application** launch uses the host Eclipse's target platform to resolve all OSGi dependencies automatically.

---

## What DevGlobe brings you

- **Enhanced public profile** — Your GitHub, X, projects, activity, tech stack and links on a single shareable page.
- **Project directory** — Publish your projects, invite teammates, get discovered and upvoted by the community.
- **Comments & upvotes** — Threaded discussions on every project. Give and get feedback from other developers.
- **Developer dashboard** — One place to manage your profile, projects and extensions, track coding stats, unlock badges and read notifications.
- **Discovery** — Browse and filter developers & projects by language, tools and platform.
- **Networking** — See who's coding right now and in which language. Click a marker to discover a developer, their projects and their links.
- **Light & dark mode** — Full theme support across the platform.

---

## Privacy

The plugin sends programming language, editor name, OS, coding time, the origin remote URL of your current git repo (when present), branch name, and the file path **relative to your repo root** — never an absolute home path.

Files outside any git repository are not tracked beyond their language. We never read source code, file contents, keystrokes, or commit messages.

Local privacy flags can be toggled in `~/.devglobe/config.toml` under `[privacy]`: `hide_file_names`, `hide_branch_names`, `hide_project_names` (the project flag also hides branches).

Globe-side visibility (anonymous mode, repo sharing on the live globe, profile mode) is managed on [devglobe.app/dashboard/settings](https://devglobe.app/dashboard/settings).

---

## Architecture

```
eclipse-plugin/
├── META-INF/MANIFEST.MF          # OSGi bundle manifest (JavaSE-21, lazy activation)
├── plugin.xml                    # Eclipse extension points (views, commands, menus)
├── build.properties              # Build configuration
├── pom.xml                       # Maven Tycho 4.0.8 build
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
    │   └── ConfigWriter.java         # Reads/writes ~/.devglobe/config.toml
    ├── ui/
    │   ├── DevGlobeView.java             # Sidebar ViewPart (login + dashboard)
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
