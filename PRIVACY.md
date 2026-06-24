# Privacy & Security

> **Open source & transparent.** No code is read, no sensitive data is collected. Audit every line of this repository.

---

## What the extension sends

| Data | Sent | Detail |
|------|------|--------|
| Programming language | Yes | The language of your active tab (e.g. `TypeScript`). |
| Editor & OS | Yes | Editor name (`vscode`, `intellij`, `zed`, …) and OS (`macOS`, `Windows`, `Linux`). |
| Coding time | Yes | Computed locally from intervals between heartbeats. |
| Origin remote URL | When present | The canonical URL of your current git repo's `origin` remote (`https://github.com/foo/bar`, `https://gitlab.com/foo/bar`, etc.) — only when in a git repo. |
| Branch name | When present | The current git branch — only when in a git repo. |
| File path | When in a repo | The path **relative to your git repo root** (e.g. `src/main.ts`). Never the absolute home path. |
| Status message | Yes | Only what you set explicitly via the extension. |

## What the extension never sends

| Data | Sent |
|------|------|
| Source code | **Never** |
| File contents | **Never** |
| File paths outside a git repo | **Never** — files in non-git folders only contribute to language stats; their path is dropped |
| Keystrokes | **Never** |
| Commits, diffs, commit messages | **Never** |
| Environment variables | **Never** |
| SSH keys, credentials | **Never** |
| IP address | **Never sent by the extension** — your public IP is read by the heartbeat backend at request time for server-side geolocation, then discarded |

---

## Local privacy flags

Edit `~/.devglobe/config.toml`:

```toml
api_key = "YOUR_API_KEY"

[privacy]
hide_file_names = false
hide_branch_names = false
hide_project_names = false
```

| Flag | Effect when `true` |
|------|--------------------|
| `hide_file_names` | The `file` field is omitted from every heartbeat. |
| `hide_branch_names` | The `branch` field is omitted. |
| `hide_project_names` | The `repo` field is omitted, and so is `branch` (hiding a project while still revealing its branches would leak structural info). |

Defaults are all `false`. Filtering happens locally before the request is built — the redacted fields never leave your machine.

---

## Globe-side visibility (managed on devglobe.app)

The dashboard at [devglobe.app/dashboard/settings](https://devglobe.app/dashboard/settings) controls what other users see on the public globe and on your profile:

- **Profile mode** — `normal`, `anonymous` (city-only, no exact coordinates), or `private` (no live presence on the globe)
- **Repo sharing** — whether your current repo URL is broadcast to the live globe and shown on your profile

These toggles affect only the public, real-time view. They do not change what the extension sends.

---

## Server-side geolocation

When a heartbeat arrives, the backend looks up your public IP against [MaxMind GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) to derive city + approximate coordinates. Coordinates are then snapped to the nearest known city center so users appear at city granularity, not at their exact address.

If your profile is set to `anonymous`, the server stores no precise coordinates for that session. If `private`, no live session row is created at all.

---

## API key storage

| IDE | Storage |
|-----|---------|
| VS Code | OS keychain via `SecretStorage` (macOS Keychain, Windows Credential Manager, Linux libsecret). Old plaintext entries in `settings.json` are migrated automatically. |
| JetBrains | OS keychain via `PasswordSafe`. |
| Visual Studio | Windows Credential Manager. The `devglobe-core` daemon reads the key from `~/.devglobe/config.toml` (written with restrictive permissions). |
| Zed, NeoVim, Claude Code, Codex, OpenCode | `~/.devglobe/config.toml`, written with `0600` permissions. |

---

## Network security

- **HTTPS only** (TLS 1.2+) — no HTTP fallback
- The VS Code webview uses a **Content Security Policy** with a per-render nonce
- **No telemetry**, no third-party analytics
- All endpoints live under `https://devglobe.app`

---

## How it works under the hood

The extension hosts a JavaScript subprocess (`devglobe-core`) that:

1. Watches editor events (file change, language change).
2. Detects git context by reading `.git/HEAD` and `.git/config` directly — no `git` binary required, no shell out.
3. Resolves the origin remote URL into a canonical `https://host/owner/repo` form. Multi-provider (GitHub, GitLab, Bitbucket, self-hosted Gitea/Forgejo, Azure DevOps, …).
4. Buffers heartbeat events and flushes a batch every 30 s while you're active.
5. Pauses after 1 minute of editor inactivity. After 15 minutes the server removes you from the live globe.

The wire payload of a single batch:

```json
{
  "key": "<api-key>",
  "plugin_version": "x.y.z",
  "editor": "vscode",
  "platform": "macOS",
  "heartbeats": [
    {
      "time": 1730000000.0,
      "file": "src/main.ts",
      "language": "TypeScript",
      "repo": "https://github.com/foo/bar",
      "branch": "main"
    }
  ]
}
```

Each `heartbeats[i]` represents the editor state at `time` going forward; the server attributes the interval `[heartbeats[i].time, heartbeats[i+1].time]` to the file/language/repo of `heartbeats[i]`.

---

## Data retention

- **Live presence**: a heartbeat keeps you on the globe for 15 minutes; older session rows are pruned.
- **Coding time**: per-day, per-(language, editor, platform, repo, branch, file) buckets, retained for your dashboard, stats, streaks and badges.
- **Account data**: kept until you delete your account on [devglobe.app](https://devglobe.app), then permanently erased.
