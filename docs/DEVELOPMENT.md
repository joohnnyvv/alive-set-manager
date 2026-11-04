# Development

Use Node 24 (`nvm use`) and `npm ci`. Start development with `npm run dev`, then browse port 5173. The backend uses the application-data directory unless explicitly supplied another directory. Do not point tests or demos at personal settings.

## Verification

- `npm run lint`: Biome correctness and suspicious-code checks for backend, Solid frontend, scripts, tests and root JavaScript/TypeScript config files. Warnings fail CI. Generated files and Git-ignored files are excluded.
- `npm run lint:fix`: apply safe lint fixes; rerun `npm run lint` to check remaining findings.
- `npm run format`: format source, tests, scripts and project configuration with Biome. Uses two spaces, single JavaScript quotes, semicolons and a 100-column line width. Generated files and the dependency lockfile are excluded.
- `npm run format:check`: verify formatting without changing files; enforced in CI.
- `npm run typecheck`: backend and frontend TypeScript.
- `npm test`: unit and real HTTP/WebSocket integration tests with temporary data. MIDI discovery is simulated; no Live connection is opened.
- `npm run build`: explicitly installs the pinned Electron runtime when missing, then generates assets/notices/SBOM, compiles the backend and bundles the frontend. Electron 43 does not download its runtime during `npm ci`; the build must do this before collecting Chromium notices.
- `npm run test:e2e`: Chromium against the real server and simulated Live/MIDI.
- `npm run test:electron`: desktop smoke test; set `ASM_EXECUTABLE` to a packaged executable to test a distribution.
- `npm run verify:package`: inspect packaged archives for required resources, native addons and accidentally included development tools.

`npm run demo` uses a disposable data directory and a deterministic Live adapter. Its loopback-only test control server at port 4174 is excluded from shipped packages. `ASM_DEMO=1` in Electron also requires an explicit isolated `ASM_DATA_DIR`; normal startup never selects simulation automatically.

`npm run screenshots` captures actual UI using sample locators, local fonts and a fixed clock. The screenshot test waits for theme notifications to disappear. Review images before committing them. Browser automation cannot certify Live scheduling, audio, hardware MIDI, or mobile networking.

Linting uses Biome because its parser is independent of the project's TypeScript compiler version. The initial rules focus on correctness, with the Solid domain enabled and React rules disabled. Explicit `any` remains allowed for existing adapter and test boundaries. Formatting is enabled separately from linting; `lint:fix` applies only lint fixes. Import organization, style and accessibility rule groups are outside this initial lint baseline. Type checking remains a separate required check. The local `biome.json` schema supports editor completion; editors with Biome integration use the same configuration.

## Architecture

Backend startup accepts a data directory, Live adapter, MIDI factory and timekeeper, and returns a closeable handle. Hardware-facing behavior stays behind the adapters. Desktop-only operations use a narrow preload API, main-frame sender validation and native dialogs; no filesystem/shell API is exposed to browser clients.

The old `.ableset` directory is read only for normal migration, never in demo/test startup. Existing save formats remain version 2. App identity is `io.github.joohnnyvv.alivesetmanager`.
