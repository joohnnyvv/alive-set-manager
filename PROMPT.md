**Context**: You are implementing a web-based Ableton Live setlist controller. Two reference documents define the full architecture and frontend contract:

- **`IMPLEMENTATION_PLAN.md`** — Backend architecture, Ableton bridge, jump engine, timekeeper, MIDI mapping, WebSocket/HTTP API spec, and critical Ableton quirks.
- **`GEMINI.md`** — Frontend domain models, API contract (WebSocket + HTTP), reactive store pattern, view specifications, UI/UX patterns, and file structure.

Read both files thoroughly before writing any code. They are your single source of truth.

---

### Tech Stack
- **Backend**: Node.js 20+, TypeScript 5.x, `ableton-js`, `ws` (WebSocket), `easymidi`, Express
- **Frontend**: TypeScript, Vite, plain CSS (no heavy UI frameworks — keep it fast and small), native WebSocket + Fetch API

---

### Scope (ONLY these features — do NOT implement anything else)

1. **Setlist Editor**
    - Read songs/sections from Ableton cue points (locators)
    - Parse AbleSet-style locator notation (see `IMPLEMENTATION_PLAN.md` §2.2)
    - Drag-and-drop reordering of songs
    - Remove songs (grey out / skip), restore songs
    - Save/load setlists to JSON files
    - Searchable "add song" panel

2. **Reading Locators & Sections**
    - Fetch cue points via `ableton-js` (`song.get("cue_points")`)
    - Parse section locators (`> Section Name`)
    - Support section tracks (MIDI tracks named "Sections" or with `+SECTIONS` flag)
    - Calculate song/section durations and boundaries

3. **Ableton Control**
    - Play / Pause / Stop
    - Jump to song, jump to section
    - Read current playhead position (`current_song_time`)
    - Read tempo, time signature, `is_playing`
    - **CRITICAL**: Always use `safeStartPlaying()` and `safeStopPlaying()` from `ableton-js`. Never use raw `startPlaying()` / `stopPlaying()` — this causes the playhead to jump to the beginning of the arrangement.
    - Track active song/section by comparing `current_song_time` against song/section time ranges

4. **MIDI Mapping**
    - Use `easymidi` for cross-platform MIDI I/O
    - MIDI Learn mode: listen for next incoming message, store mapping
    - Support Note On, Note Off, CC, PC messages
    - Map to actions: play, pause, stop, next-song, prev-song, next-section, prev-section, jump-to-song, jump-to-section, toggle-loop, **GO button**, cancel-queue
    - **GO button logic**: If stopped at song end → next song; if stopped inside song → play; if playing in loop → escape loop; if playing with queued jump → execute jump now
    - Persist mappings to JSON config file

5. **Mobile Device Connection**
    - Backend hosts HTTP + WebSocket server on port 80 (fallback to 3000+ if taken)
    - Frontend is a responsive web app optimized for phones/tablets
    - Display current IP/hostname for easy connection
    - Prevent screen sleep in Performance view (`navigator.wakeLock` or fallback)

6. **Jump Modes**
    - Implement all 5 modes: **Quantized**, **End of Section**, **End of Song**, **Dynamic**, **Manual**
    - Use the **lookahead scheduler** pattern (25ms interval, 100ms schedule-ahead) from `IMPLEMENTATION_PLAN.md` §2.5
    - Use the **pre-activation trick**: call `cue.jump()` ~50–100ms BEFORE the musical boundary so Ableton's internal quantization lands exactly on the beat/bar
    - Queue/cancel UI must adapt per mode (see `GEMINI.md` §8)

---

### Critical Constraints & Warnings

- **The "Jump to Beginning" Bug**: Ableton snaps the playhead to bar 1 if you call `startPlaying()` while already playing or `stopPlaying()` while already stopped. Guard every play/stop call with `safeStartPlaying()` / `safeStopPlaying()`. Check `is_playing` state before issuing commands.
- **Quantization**: Ableton's `cue.jump()` respects global quantization. Do NOT try to calculate exact jump times yourself for Quantized mode — let Ableton handle it. For End-of-Section/Song/Dynamic modes, schedule the `jump()` call slightly ahead of the boundary.
- **Time Precision**: Use the Timekeeper/lookahead scheduler for all musical events. Do NOT rely on `setTimeout` for beat-accurate scheduling.
- **Floating Point**: Use a tolerance of ~0.01 beats when comparing `current_song_time` to song/section boundaries.
- **Reconnection**: When Ableton loads a new project, `ableton-js` emits a `disconnect` then `connect`. Re-initialize all listeners and re-fetch cue points on every `connect` event.
- **Windows MIDI**: Only one app can open a MIDI input. If a device is mapped in our app, it must be disabled in Ableton Live's MIDI preferences.

---

### Implementation Order

Follow this order strictly. Do not skip ahead.

**Phase 1 — Foundation**
1. Set up Node.js/TypeScript project with Vite frontend
2. Integrate `ableton-js`, establish connection, handle connect/disconnect lifecycle
3. Build Ableton Bridge module wrapping `ableton-js` with safe methods
4. Implement Locator Parser (basic song + section parsing)
5. Build Setlist Engine (read-only from locators)
6. Basic Express server + WebSocket server
7. Frontend skeleton with WebSocket client and reactive store

**Phase 2 — Playback Control**
8. Play / Pause / Stop with safe wrappers
9. Current time tracking via WebSocket broadcasts
10. Jump to song (immediate) and jump to section (immediate)
11. Active song/section detection from `current_song_time`
12. Progress bars (song + section)
13. **Verify**: No "jump to start" bugs in any scenario

**Phase 3 — Jump Modes & Scheduling**
14. Implement Timekeeper with lookahead scheduler
15. Implement Jump Engine with state machine (IDLE → QUEUED → JUMPING)
16. Quantized jump mode
17. End-of-Section jump mode
18. End-of-Song jump mode
19. Dynamic jump mode
20. Manual jump mode
21. Queue/cancel UI
22. Stop behavior at song end: `auto-jump` vs `stop` vs `pause` (configurable per song)

**Phase 4 — Setlist Editor**
23. Drag-and-drop reordering
24. Remove/restore songs
25. Add songs from available pool
26. Song detail overrides (color, stop behavior)
27. Save/load setlist files
28. Copy/paste setlist (text format: one song per line)

**Phase 5 — MIDI Mapping**
29. MIDI input detection with `easymidi`
30. MIDI learn functionality
31. Map messages to actions
32. GO button smart logic
33. Persist mappings to JSON
34. MIDI mapping UI in settings

**Phase 6 — Polish & Mobile**
35. Responsive CSS for mobile/tablet (48dp+ touch targets)
36. Performance view (large, stage-friendly)
37. Sections view (quick jumps)
38. Prevent screen sleep
39. Network discovery display (IP/hostname)
40. Error handling & reconnection logic

---

### Output Structure

```
ableset-clone/
├── src/               # Backend TypeScript
├── frontend/src/      # Frontend TypeScript + HTML + CSS
├── setlists/          # Saved setlists (created at runtime)
├── package.json
└── tsconfig.json
```

Match the file structure in `IMPLEMENTATION_PLAN.md` §6 and `GEMINI.md` §11 as closely as possible.

---

### Quality Gates

Before marking any phase complete, verify:
- TypeScript compiles with `strict: true`
- No raw `startPlaying()` / `stopPlaying()` calls exist in the codebase
- WebSocket reconnects automatically after Ableton project reload
- All 5 jump modes behave correctly with Ableton's quantization
- Touch targets are ≥48dp on mobile
- Frontend works on iOS Safari and Android Chrome

---

**Begin with Phase 1. Ask clarifying questions if any requirement is ambiguous. Do not hallucinate APIs — use only the `ableton-js` APIs documented in `IMPLEMENTATION_PLAN.md` and the official `ableton-js` repository.**