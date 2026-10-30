# Changelog

User-facing changes are curated here. Versions follow semantic versioning; alpha releases may change behavior and formats.

## [Unreleased]

## [0.1.0-alpha.2] — 2026-10-30

### Fixed

- The saved default startup view is now honored after choosing it in Settings, even if first-run setup was not explicitly dismissed. A delayed setup check no longer overrides navigation.
- Updated dependencies to fix security vulnerabilities.

### Known limitations

- Signed/notarized beta distribution and automatic update installation remain gated on credentials and acceptance testing.

## [0.1.0-alpha.1] — 2026-10-29

### Added

- Original pulse app icon and macOS arm64/x64 and Windows x64 packaging.
- First-run AbletonJS installation with version/content checks, backups and custom User Library selection.
- Offline Help, About, license notices, manual update checking and redacted diagnostics export.
- Deterministic Live/MIDI simulation, HTTP/WebSocket integration tests, browser E2E and packaged desktop smoke tests.
- PR build/test checks, dependency updates and tag-triggered draft releases with checksums and SBOMs.
- Populated screenshot gallery for all five themes and mobile Stage View.

### Fixed

- Single-instance startup, macOS window reopen and backend resource cleanup.
- Atomic settings/setlist/MIDI saves, isolated test storage and migration from legacy `.ableset` data.
- Startup failures no longer fall back to an unrelated service on port 8080.
- Fonts are bundled for offline use; build tools are excluded from app packages.
- Dependency security advisories addressed, including Electron and AbletonJS’s UUID helper.

### Known limitations

- Unsigned alpha; downloaded-installation, Windows/Intel, physical MIDI, real mobile LAN and rehearsal acceptance are recorded separately in the release checklist.
- Updates require manual download and installation. Live 11 and Linux are unverified.
- Demo tests do not certify Live’s timing or every MIDI controller. Save the Live project and named setlist independently.
