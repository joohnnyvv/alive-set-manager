# Development

Use Node 24 (`nvm use`) and `npm ci`. Start development with `npm run dev`, then browse port 5173. The backend uses the application-data directory unless explicitly supplied another directory. Do not point tests or demos at personal settings.

## Verification

- `npm run typecheck`: backend and frontend TypeScript.
- `npm test`: unit and real HTTP/WebSocket integration tests with temporary data. MIDI discovery is simulated; no Live connection is opened.
- `npm run build`: explicitly installs the pinned Electron runtime when missing, then generates assets/notices/SBOM, compiles the backend and bundles the frontend. Electron 43 does not download its runtime during `npm ci`; the build must do this before collecting Chromium notices.
- `npm run test:e2e`: Chromium against the real server and simulated Live/MIDI.
- `npm run test:electron`: desktop smoke test; set `ASM_EXECUTABLE` to a packaged executable to test a distribution.
- `npm run verify:package`: inspect packaged archives for required resources, native addons and accidentally included development tools.

`npm run demo` uses a disposable data directory and a deterministic Live adapter. Its loopback-only test control server at port 4174 is excluded from shipped packages. `ASM_DEMO=1` in Electron also requires an explicit isolated `ASM_DATA_DIR`; normal startup never selects simulation automatically.

`npm run screenshots` captures actual UI using sample locators, local fonts and a fixed clock. The screenshot test waits for theme notifications to disappear. Review images before committing them. Browser automation cannot certify Live scheduling, audio, hardware MIDI, or mobile networking.

## Architecture

Backend startup accepts a data directory, Live adapter, MIDI factory and timekeeper, and returns a closeable handle. Hardware-facing behavior stays behind the adapters. Desktop-only operations use a narrow preload API, main-frame sender validation and native dialogs; no filesystem/shell API is exposed to browser clients.

The old `.ableset` directory is read only for normal migration, never in demo/test startup. Existing save formats remain version 2. App identity is `io.github.joohnnyvv.alivesetmanager`.
