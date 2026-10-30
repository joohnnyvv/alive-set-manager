# Alpha acceptance record

Target: 0.1.0-alpha.1. Date: 2026-10-29. A checked automated test is not a certification of physical hardware or a published download.

## Verified locally

- [x] Backend and frontend type checks and production build.
- [x] 56 unit/integration tests, isolated data and simulated MIDI, including real HTTP/WebSocket authentication and restart persistence.
- [x] Browser E2E: transport/manual queue, themes, save/reload, dialog keyboard handling, empty/disconnected/reconnected states and mobile Help.
- [x] Populated screenshots of five themes, setlist, sections, help and mobile Stage View.
- [x] Dependency audit: zero reported vulnerabilities after compatible upgrades and the documented UUID override.
- [x] macOS arm64 package content inspection: icons/resources, native binaries, matching script, notices and no development tooling.
- [x] Actual AbletonJS 4.1.0 connection to running Live 12.4.15, independently of MCP; all 11 demo locators parsed as Northern Lights and Paper Satellites.
- [x] macOS arm64 DMG and ZIP built locally.
- [x] Final packaged macOS arm64 Electron smoke test: first-run setup, native MIDI module load, reload and relaunch persistence.
- [x] Demo locators added to the previously empty running Live set; stopped playhead restored to beat zero. The running demo has two songs within the original arrangement length; no audio was added and the set was not saved over a user file.

## Must be completed before public release

- [x] GitHub master branch protection configured with all four required checks; dependency alerts and security fixes enabled.
- [x] GitHub workflows run on the pushed implementation.
- [x] Node 24 clean-install verification in CI (local build host currently uses Node 22.16).
- [x] Downloaded macOS arm64 DMG installs on a clean account; Dock/Finder icons checked.
- [ ] macOS Intel build, smoke and clean-account installation.
- [ ] Windows x64 build, smoke, installer/uninstaller and native MIDI loading.
- [ ] First-run installation on fresh/custom/redirected User Libraries with Live 12 on each OS.
- [ ] Real Live transport, all queued jump modes, counted loops and reconnect acceptance.
- [ ] Physical MIDI Learn and mapped controller actions.
- [ ] Real phone/tablet LAN pairing, firewall behavior and browser capability limits.
- [x] Previous-app replacement preserves settings, saved setlists and MIDI mappings.
- [ ] Complete rehearsal-length session without unsafe playback, data loss or crashes.
- [ ] All draft assets, checksum list and per-platform license inventories reviewed.

No release/tag has been published by this implementation. Signing/notarization and in-app update installation remain beta prerequisites.
