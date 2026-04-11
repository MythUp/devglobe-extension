# Privacy & Security

> **Open source & transparent** — These extensions are 100% open source. No code is read, no sensitive data is collected. You can audit every line of this repository.

---

## What the extension sends

| Data | Sent | Detail |
|------|------|--------|
| Programming language | Yes | The language name of your active tab (e.g. "TypeScript"). Nothing else. |
| Operating system | Yes | One of `macOS`, `Windows` or `Linux` — displayed on your profile next to your coding stats. |
| Approximate location | Yes | City + coordinates **snapped to your city center** (from a database of 152,000+ cities). You appear as an area on the globe, not an address. |
| Repo name | **You decide** | `owner/repo` is **only sent to the server if you enable the "Share repo" toggle** (disabled by default). When disabled, your repo name never leaves your IDE. |
| Commit data | **Never** | The extension never reads or sends commit data — no diffs, no insertions/deletions, no commit messages. |
| Anonymous mode | **You decide** | When enabled, your real coordinates are replaced with a random city in your country (from a database of 152,000+ cities worldwide). Your actual location is never sent to DevGlobe. |
| Coding time | Yes | Accumulated per day, per language. |
| Status message | Yes | Only what you write yourself. |

## What the extension does NOT send

| Data | Sent |
|------|------|
| Your source code | **Never** |
| Your file contents | **Never** |
| Your file names | **Never** |
| Your folder paths | **Never** |
| Your keystrokes | **Never** |
| Your commit messages | **Never** |
| Your Git branches | **Never** |
| Your IP address | **Never stored** — used only to determine city via a geolocation service, then discarded, the IP stays on your IDE |
| Your environment variables | **Never** |
| Your SSH keys or credentials | **Never** |

---

## Location: how it works exactly

The extension determines your city from your IP address via external geolocation services (freeipapi.com, with fallback to ipapi.co and ipwho.is). All are free public services, no API key required.

**Coordinates are snapped to your city center** using a database of 152,000+ cities (GeoNames). You appear at your city's canonical center on the globe, not at your address. If the city is not found in the database, coordinates are randomly offset within a 20 km radius.

The location is **cached for 1 hour** — the extension does not call the geolocation service on every heartbeat.

**Your IP address is never transmitted to DevGlobe.** It is only used by the third-party geolocation service to determine your city, then discarded.

---

## API key storage

Your DevGlobe API key is stored securely using each platform's best available method.

| IDE | Storage method |
|-----|----------------|
| VS Code | **SecretStorage** — your OS system keychain (macOS Keychain, Windows Credential Manager, Linux libsecret) |
| JetBrains | **PasswordSafe** — the IDE's native credential manager, backed by the OS keychain |
| Claude Code | **Environment variable** (`DEVGLOBE_API_KEY`) or **config file** (`~/.devglobe/api_key`) — Claude Code has no keychain API, so the key is stored in a local config file readable only by your user |

The VS Code extension automatically migrates old keys that were stored in plain text in `settings.json` to the secure keychain.

---

## Network security

- **HTTPS only** (TLS 1.2+) — no HTTP fallback
- Heartbeats go directly to the database — no intermediary server
- The VS Code side panel uses a **Content Security Policy** with a cryptographic nonce to prevent script injection
- Server-side, Row Level Security policies isolate each user's data
- **No telemetry** — no third-party analytics or tracking services

---

## How it works technically

### The heartbeat

Every 30 seconds, if you've typed code in the last minute, the extension sends a heartbeat to the database. This heartbeat contains:

```
{
  api_key,                      // your identifier (stored in the OS keychain)
  latitude, longitude,          // snapped to city center (152k+ cities)
  city,                         // "Paris, France"
  language,                     // "TypeScript"
  editor,                       // "vscode", "intellij", "claude-code", etc.
  platform,                     // "macOS", "Windows" or "Linux"
  repo,                         // "owner/repo" (only sent if share_repo is true — never leaves the IDE otherwise)
  share_repo,                   // true/false — when true, repo name is sent and displayed on your profile
  anonymous,                    // true/false — when true, coordinates are a random city
}
```

The server responds with today's total coding time. The extension updates the display in the sidebar and status bar.

### Language detection

- **VS Code**: reads the `languageId` of the active editor, then translates it via a table of 48+ languages (JavaScript, TypeScript, Python, Rust, Go, Kotlin, etc.)
- **JetBrains**: uses the IDE's native `FileType` system — no manual table, automatically supports all languages your IDE supports
- **Claude Code**: detects the language from the file extension of edited files

### Git integration

The extension runs `git remote get-url origin` in your active file's directory and extracts the `owner/repo` identifier from the URL (SSH or HTTPS). The result is cached for 5 minutes.

**The extension never reads commits, diffs, or file contents.**

### Anonymous mode

When anonymous mode is enabled, the extension replaces your real coordinates with a **random city in your country**, chosen from a database of 152,000+ cities worldwide (GeoNames). Your actual location is never transmitted to DevGlobe. The random city is selected once per session and stays consistent until you restart your IDE or toggle the mode.

On the globe, your profile displays an "anonymous mode" badge instead of your city name.

### Offline detection

After 2 consecutive network failures, the extension switches to offline mode and notifies you. As soon as the connection is back, it automatically resumes heartbeats.

### Architecture

```
vscode-extension/
├── src/
│   ├── extension.ts      # Lifecycle, API key management (SecretStorage)
│   ├── tracker.ts        # State machine, heartbeat loop, offline detection
│   ├── heartbeat.ts      # HTTP calls to the database
│   ├── sidebar.ts        # Side panel (webview HTML/CSS/JS)
│   ├── geo.ts            # IP geolocation (dual provider + fallback)
│   ├── git.ts            # Repo detection (owner/repo from remote)
│   ├── language.ts       # languageId → display name translation
│   ├── logger.ts         # Debug/info/warn/error logs
│   └── constants.ts      # URLs, timeouts, intervals
└── package.json

jetbrains-plugin/
├── src/main/kotlin/xyz/devglobe/plugin/
│   ├── core/
│   │   ├── DevGlobeTracker.kt    # Singleton tracker, heartbeat scheduler
│   │   ├── HeartbeatService.kt   # HTTP client
│   │   ├── GeoService.kt         # IP geolocation (same logic)
│   │   ├── GitService.kt         # Repo detection (owner/repo from remote)
│   │   ├── LanguageService.kt    # Language detection via native FileType
│   │   ├── TrackerState.kt       # Immutable state
│   │   └── Constants.kt          # URLs, timeouts, intervals
│   ├── auth/
│   │   └── ApiKeyStorage.kt      # PasswordSafe wrapper (OS keychain)
│   ├── settings/
│   │   └── DevGlobeSettings.kt   # IDE settings persistence
│   ├── ui/
│   │   ├── SidebarPanel.kt       # Swing panel (login + dashboard)
│   │   ├── SidebarFactory.kt     # Tool window integration
│   │   └── DevGlobeStatusBarFactory.kt
│   └── DevGlobeStartupActivity.kt
├── src/main/resources/META-INF/
│   └── plugin.xml
└── build.gradle.kts

claude-code-plugin/
├── plugins/devglobe/
│   ├── src/
│   │   ├── index.ts           # Heartbeat logic (PostToolUse, UserPromptSubmit, Stop)
│   │   ├── update-status.ts   # Status message API script
│   │   ├── types.ts           # TypeScript type definitions
│   │   ├── lang.ts            # File extension → language mapping
│   │   └── data/
│   │       └── city-centers.json  # 152k+ cities (GeoNames)
│   ├── hooks/
│   │   └── hooks.json         # Claude Code hook definitions
│   ├── skills/
│   │   ├── setup/SKILL.md         # /devglobe:setup
│   │   ├── anonymous/SKILL.md     # /devglobe:anonymous
│   │   ├── share-repo/SKILL.md    # /devglobe:share-repo
│   │   └── status/SKILL.md        # /devglobe:status
│   ├── scripts/
│   │   ├── run                # Heartbeat launcher
│   │   └── update-status      # Status message launcher
│   └── package.json
└── .claude-plugin/
    └── marketplace.json
```

---

## Third-party services

The extensions rely on three external services for IP geolocation. Neither receives your DevGlobe API key or any coding data.

| Service | Purpose | Data sent | Privacy policy |
|---------|---------|-----------|----------------|
| [freeipapi.com](https://freeipapi.com) | IP geolocation (primary) | Your IP address (via standard HTTPS request) | [freeipapi.com/privacy](https://freeipapi.com) |
| [ipapi.co](https://ipapi.co) | IP geolocation (fallback #1) | Your IP address (via standard HTTPS request) | [ipapi.co/privacy](https://ipapi.co/privacy/) |
| [ipwho.is](https://ipwho.is) | IP geolocation (fallback #2) | Your IP address (via standard HTTPS request) | [ipwho.is](https://ipwho.is) |

Your IP address is used only to determine your city. It is never transmitted to or stored by DevGlobe.

---

## Data retention

- **Heartbeats**: Your last heartbeat determines your live status on the globe. Heartbeats older than **10 minutes** are considered expired and your marker is removed from the globe.
- **Coding time**: Daily coding time is retained for your dashboard stats, streaks, and badges.
- **Account data**: Retained until you delete your account.

---

## Account deletion

If you delete your account on [devglobe.xyz](https://devglobe.xyz), all your data is permanently erased. No information is kept.
