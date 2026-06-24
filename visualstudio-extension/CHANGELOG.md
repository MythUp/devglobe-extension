# Changelog

All notable changes to the DevGlobe Visual Studio extension are documented here.

## [1.0.0] - 2026-06-23

### Added

- Initial release of DevGlobe for Visual Studio (VS 2022 / VS 2026).
- DevGlobe tool window with **Login** and **Dashboard** views.
- Live heartbeat tracking driven by the `devglobe-core` binary (heartbeat every 30s, auto-pause after 1 min of inactivity).
- Activity detection: typing, active document, document open/save.
- Language detection from the active document.
- Status bar showing today's coding time.
- Six commands under **Tools → DevGlobe**: Set Status Message, Show Coding Time, Open Globe, Debug, Open Log File, Open Config File.
- API key stored in the Windows Credential Manager and written to `%USERPROFILE%\.devglobe\config.toml`.
- One-time download of the `devglobe-core-win-x64.exe` binary from GitHub Releases on first launch, cached under `%LOCALAPPDATA%\DevGlobe\core`.
