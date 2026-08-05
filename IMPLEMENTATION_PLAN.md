# AbleSet Clone — Comprehensive Implementation Plan

## Overview

This document outlines the architecture and implementation strategy for a web-based Ableton Live setlist controller inspired by AbleSet. It uses `ableton-js` for Ableton communication, a Node.js/TypeScript backend, and a web frontend optimized for mobile/tablet devices.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Browser)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ Setlist View│  │Performance  │  │ Settings / MIDI Map │   │
│  │             │  │   View      │  │                     │   │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘   │
│         └─────────────────┴────────────────────┘                │
│                         WebSocket Client                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP + WebSocket
┌─────────────────────────────┴───────────────────────────────────┐
│                      BACKEND (Node.js/TS)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  Express    │  │  WebSocket  │  │   MIDI Input        │   │
│  │   Server    │  │   Server    │  │   (easymidi)        │   │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘   │
│         └─────────────────┴────────────────────┘                │
│                         Core Services                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │SetlistEngine│  │ JumpEngine  │  │   Timekeeper        │   │
│  │             │  │             │  │   (Scheduler)       │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│                              │                                   │
│                         ableton-js                               │
│                              │                                   │
│                    UDP ↔ AbletonJS MIDI Script                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│                     ABLETON LIVE                                  │
│         (Arrangement with Locators & Section Tracks)            │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack
- **Backend**: Node.js 20+, TypeScript 5.x, Express, `ws` (WebSocket), `ableton-js`, `easymidi`
- **Frontend**: Vanilla TS or React/Vue/Svelte (your choice), responsive PWA
- **Storage**: JSON files on disk (project-scoped), plus in-memory state
- **Network**: Hosts its own HTTP server on port 80 (or fallback 3000+)

---

## 2. Backend Module Breakdown

### 2.1 Ableton Bridge (`src/ableton/bridge.ts`)
**Responsibility**: All direct communication with Ableton via `ableton-js`.

**Key APIs Used**:
```typescript
// Connection
const ableton = new Ableton({ logger: console });
await ableton.start();

// Locators (Cue Points)
const cues = await ableton.song.get("cue_points"); // RawCuePoint[] { id, name, time }
const cue = cues[0];
await cue.jump(); // Jump to cue

// Playback Control
await ableton.song.startPlaying();
await ableton.song.stopPlaying();
await ableton.song.safeStartPlaying();  // ⭐ CRITICAL: avoids jump-to-start bug
await ableton.song.safeStopPlaying();   // ⭐ CRITICAL: avoids jump-to-start bug
await ableton.song.set("current_song_time", beatTime);

// State Observation
ableton.song.addListener("is_playing", (playing) => { ... });
ableton.song.addListener("current_song_time", (time) => { ... });
ableton.song.addListener("cue_points", (cues) => { ... });
ableton.song.addListener("tempo", (tempo) => { ... });

// Tracks (for Section Tracks)
const tracks = await ableton.song.get("tracks");
const clips = await track.get("arrangement_clips"); // { name, start_time, end_time, color }
```

**Important**: Always use `safeStartPlaying()` and `safeStopPlaying()` instead of raw `startPlaying()`/`stopPlaying()`. Ableton has a quirk where starting playback when already playing or stopping when already stopped causes the playhead to jump to the beginning of the arrangement. The `safe*` variants guard against this.

### 2.2 Locator Parser (`src/parsers/locator.ts`)
**Responsibility**: Parse Ableton cue point names into structured song/section metadata.

**Notation to Support** (based on AbleSet docs):

| Pattern | Meaning | Example |
|---------|---------|---------|
| `Song Name` | Song start locator | `Never Gonna Give You Up` |
| `> Section` | Section start | `> Verse 2` |
| `>> Section` | Quick-access section | `>> Chorus` |
| `{...}` | Description metadata | `Follow Night {Tuning: C, Capo 1}` |
| `SONG END` | End of song (auto-jump next) | `SONG END` |
| `STOP` / `AUTOSTOP` | End of song (stop playback) | `STOP` |
| `+PAUSE` | Pause at this locator | `> Chorus +PAUSE` |
| `+LOOP` | Loop from here to next locator | `> Bridge +LOOP` |
| `+LOOPFULL` | Loop, finish current loop before jump | `> Bridge +LOOPFULL` |
| `+LOOP:4` | Loop exactly 4 times | `> Bridge +LOOP:4` |
| `+SKIP` | Skip this section | `> Intro +SKIP` |
| `+END` | Mark subsequent sections as optional | `> Outro +END` |
| `+JUMP` | After stop, jump to next song | `STOP +JUMP` |
| `+STAY` | After stop, stay at stop locator | `STOP +STAY` |
| `#tag` | Song tag | `Follow Night #rock #live` |
| `[3:20]` | Duration override | `Follow Night [3:20]` |
| `[blue]` | Color override | `Follow Night [blue]` |
| `[nosong]` | Non-song item | `Interlude [nosong]` |
| `>>> Target` | Auto-transition to section | `Intro >>> Verse 1` |
| `* ...` | Ignored locator | `* Check automation` |

**Parser Output**:
```typescript
interface ParsedLocator {
  rawName: string;
  type: 'song' | 'section' | 'song-end' | 'stop' | 'ignored';
  name: string;
  description?: string;
  time: number; // in beats
  color?: string;
  tags: string[];
  duration?: number; // seconds, from [mm:ss] or calculated
  flags: LocatorFlags;
  transitionTarget?: string;
}

interface LocatorFlags {
  pause: boolean;
  loop: boolean;
  loopFull: boolean;
  loopCount?: number;
  skip: boolean;
  end: boolean;
  jump: boolean; // for stop locators
  stay: boolean; // for stop locators
  nosong: boolean;
  quickJump: boolean; // >>
}
```

### 2.3 Setlist Engine (`src/engine/setlist.ts`)
**Responsibility**: Build and manage the setlist from parsed locators.

**Core Logic**:
1. Fetch all cue points from Ableton
2. Sort by `time` (ascending)
3. Parse each with `LocatorParser`
4. Group sections into songs:
   - A "song" starts at a non-section, non-ignored, non-end locator
   - It continues until the next song locator, `SONG END`, or `STOP`
   - Section locators (`>`) between two song locators belong to the preceding song
5. Calculate durations:
   - If `[mm:ss]` override exists, use it
   - Otherwise: `(nextSongTime - thisSongTime) / tempo * 60` seconds
   - For last song: use `song_length` from Ableton

**Data Model**:
```typescript
interface Song {
  id: string; // derived from locator name + time hash
  name: string;
  description?: string;
  startTime: number; // beats
  endTime: number;   // beats
  duration: number;  // seconds
  color?: string;
  tags: string[];
  sections: Section[];
  stopBehavior: 'jump-next' | 'stop' | 'default';
  flags: { nosong: boolean; end: boolean };
}

interface Section {
  id: string;
  name: string;
  description?: string;
  startTime: number;
  endTime: number;
  duration: number;
  color?: string;
  flags: LocatorFlags;
  transitionTarget?: string;
}
```

**Setlist State**:
```typescript
interface Setlist {
  songs: Song[];
  order: string[]; // ordered song IDs
  activeSongId?: string;
  activeSectionId?: string;
  queuedSongId?: string;
  queuedSectionId?: string;
  isPlaying: boolean;
  currentTime: number; // beats
  totalDuration: number;
  remainingTime: number;
}
```

### 2.4 Jump Engine (`src/engine/jump.ts`) ⭐ CRITICAL MODULE
**Responsibility**: Handle all playback jumps with correct timing and quantization.

#### The Core Problem
Ableton's `cue.jump()` respects **global quantization**. If you call `jump()` at beat 10.0 with quantization set to "1 bar" in 4/4, Ableton will jump at beat 12.0, not immediately. This is both a feature and a complexity.

AbleSet solves this by **activating the locator a short time before the jump is supposed to happen**, which respects Live's global quantization naturally.

#### Jump Modes to Implement

| Mode | Behavior |
|------|----------|
| **Quantized** | Jump immediately when triggered, letting Ableton quantize naturally |
| **End of Section** | Queue the target; jump when current section ends |
| **End of Song** | Queue the target; jump when current song ends |
| **Dynamic** | Queue section → jump at section end; Queue song → jump at song end |
| **Manual** | Only jump when playback stops (STOP locator reached or manual stop) |

#### Jump State Machine
```
States: IDLE, QUEUED, JUMPING, LOOPING, PAUSED

IDLE → QUEUED: User selects target song/section
QUEUED → JUMPING: Trigger condition met (quantization point / section end / song end / manual)
JUMPING → IDLE: Jump executed, playback continues
QUEUED → IDLE: User cancels
```

#### Time & Scheduling Logic

**Beat-Time Tracking**:
- Subscribe to `ableton.song.addListener("current_song_time", ...)`
- Subscribe to `ableton.song.addListener("is_playing", ...)`
- Maintain a `currentBeatTime` in the backend state

**Quantization-Aware Scheduling**:
```typescript
function getQuantizedJumpTime(
  currentTime: number,
  quantization: Quantization,
  timeSignature: [number, number]
): number {
  // Convert quantization to beats
  const quantBeats = quantizationToBeats(quantization, timeSignature);

  // Find next multiple of quantBeats after currentTime
  const nextQuantPoint = Math.ceil(currentTime / quantBeats) * quantBeats;

  // AbleSet trick: activate the locator slightly BEFORE the target
  // so Ableton's internal quantization lands exactly at the right point
  return nextQuantPoint;
}
```

**The AbleSet Pre-Activation Trick**:
When jumping during playback, don't wait until the exact beat to call `jump()`. Instead:
1. Calculate when the jump SHOULD happen (e.g., end of next bar)
2. Schedule the `cue.jump()` call ~50-100ms before that point
3. Ableton receives the jump command, queues it internally
4. Ableton's own quantization fires the jump at exactly the right musical boundary

**Section End Detection**:
```typescript
function isAtSectionEnd(
  currentTime: number,
  section: Section,
  tolerance: number = 0.1 // beats
): boolean {
  return Math.abs(currentTime - section.endTime) <= tolerance;
}
```

**Song End Detection**:
```typescript
function isAtSongEnd(
  currentTime: number,
  song: Song,
  tolerance: number = 0.1
): boolean {
  return Math.abs(currentTime - song.endTime) <= tolerance;
}
```

**Jump Execution Flow**:
```typescript
async function executeJump(target: Song | Section) {
  // 1. Find the cue point corresponding to the target
  const cue = findCueByTime(target.startTime);

  // 2. If playback is stopped, jump immediately
  if (!isPlaying) {
    await cue.jump();
    return;
  }

  // 3. If playback is running, the jump timing depends on Jump Mode
  // For Quantized mode: call jump() now, Ableton handles quantization
  // For End-of-Section/Song: we wait until the boundary

  // 4. For modes that require waiting, the Timekeeper schedules it
}
```

### 2.5 Timekeeper / Scheduler (`src/engine/timekeeper.ts`)
**Responsibility**: Precise scheduling of future events based on beat time.

**Why not just setTimeout?**
- JavaScript timers are imprecise (~4ms drift)
- We need musical precision
- Solution: Use a **lookahead scheduler** pattern

**Lookahead Scheduler Pattern**:
```typescript
class Timekeeper {
  private lookahead = 25.0;  // ms: how often to check
  private scheduleAhead = 100.0; // ms: how far ahead to schedule
  private timerID?: NodeJS.Timeout;

  start() {
    this.timerID = setInterval(() => this.tick(), this.lookahead);
  }

  private tick() {
    const current = this.getCurrentBeatTime();
    const ahead = this.beatsFromMs(this.scheduleAhead);

    // Check all scheduled events
    for (const event of this.scheduledEvents) {
      if (event.time <= current + ahead && !event.triggered) {
        event.triggered = true;
        event.callback();
      }
    }

    // Clean up past events
    this.scheduledEvents = this.scheduledEvents.filter(e => e.time > current);
  }

  scheduleAt(beatTime: number, callback: () => void) {
    this.scheduledEvents.push({ time: beatTime, callback, triggered: false });
  }
}
```

**Beat-Time to Real-Time Conversion**:
```typescript
function beatsToMs(beats: number, tempo: number): number {
  return (beats / tempo) * 60 * 1000;
}

function msToBeats(ms: number, tempo: number): number {
  return (ms / 1000 / 60) * tempo;
}
```

### 2.6 Stop/Continue Behavior at Song End ⭐ CRITICAL

**The User Requirement**: "User can decide whether to automatically jump to next song at the end or jump and stop."

**Implementation**:

```typescript
interface SongEndBehavior {
  type: 'auto-jump' | 'stop' | 'pause';
  // For 'auto-jump': jump to next song immediately
  // For 'stop': stop playback at song end
  // For 'pause': pause playback at song end (playhead stays at end)
}

// Configuration per song (from locator flags + setlist editor overrides)
const defaultBehavior: SongEndBehavior = { type: 'auto-jump' };

// When approaching song end:
async function onApproachSongEnd(song: Song, nextSong?: Song) {
  const behavior = song.stopBehavior || defaultBehavior;

  switch (behavior.type) {
    case 'auto-jump':
      if (nextSong) {
        // Schedule jump to next song's start cue
        timekeeper.scheduleAt(song.endTime, () => {
          jumpToSong(nextSong);
        });
      } else {
        // Last song: stop
        timekeeper.scheduleAt(song.endTime, () => {
          ableton.song.safeStopPlaying();
        });
      }
      break;

    case 'stop':
      timekeeper.scheduleAt(song.endTime, () => {
        ableton.song.safeStopPlaying();
      });
      break;

    case 'pause':
      timekeeper.scheduleAt(song.endTime, () => {
        ableton.song.safeStopPlaying();
        // Note: In Ableton, "pause" is just stop + playhead stays
        // Actually Ableton doesn't have a true "pause" in Arrangement
        // We simulate it by stopping and NOT resetting position
      });
      break;
  }
}
```

**Avoiding the "Jump to Beginning" Bug**:

This is the most critical bug to avoid. It happens when:
1. You call `startPlaying()` while already playing → playhead jumps to start
2. You call `stopPlaying()` while already stopped → playhead jumps to start
3. You load a new project while connected → listeners break

**Mitigations**:
- Always use `safeStartPlaying()` / `safeStopPlaying()` from ableton-js
- Before any play/stop command, check `is_playing` state
- After project load (disconnect event), re-initialize all listeners
- When jumping to a cue while stopped, use `cue.jump()` then `safeStartPlaying()`
- When jumping to a cue while playing, just use `cue.jump()` — Ableton handles the transition

### 2.7 MIDI Mapping Engine (`src/midi/engine.ts`)
**Responsibility**: Map physical MIDI controllers to software actions.

**Libraries**: `easymidi` for cross-platform MIDI I/O

**Architecture**:
```typescript
interface MidiMapping {
  id: string;
  inputName: string; // MIDI port name
  messageType: 'note-on' | 'note-off' | 'cc' | 'pc';
  channel: number; // 1-16
  note?: number;  // for note-on/off
  cc?: number;    // for CC
  value?: number; // specific value or any
  action: MidiAction;
}

type MidiAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'next-song' }
  | { type: 'prev-song' }
  | { type: 'next-section' }
  | { type: 'prev-section' }
  | { type: 'jump-to-song'; songIndex: number }
  | { type: 'jump-to-section'; sectionIndex: number }
  | { type: 'toggle-loop' }
  | { type: 'go' } // Smart button: play/pause/next/escape-loop
  | { type: 'cancel-queue' };
```

**The "Go" Button Logic** (from AbleSet docs):
```typescript
async function handleGoButton() {
  const state = getCurrentState();

  if (!state.isPlaying && state.isAtSongEnd) {
    // Stopped at end → jump to next song
    await jumpToNextSong();
  } else if (!state.isPlaying && state.isInsideSong) {
    // Stopped inside song → start playback
    await ableton.song.safeStartPlaying();
  } else if (state.isPlaying && state.isLooping) {
    // Playing in loop → escape loop
    await disableLoop();
  } else if (state.isPlaying && state.hasQueuedJump) {
    // Playing with queued jump → execute immediately
    await executeQueuedJump();
  }
}
```

**MIDI Learning**:
1. User clicks "Learn" in settings
2. Backend listens for next MIDI message on all inputs
3. When message received, store mapping
4. Persist to JSON config file

### 2.8 WebSocket API (`src/server/websocket.ts`)
**Responsibility**: Real-time bidirectional communication with frontend(s).

**Protocol**: JSON messages over WebSocket

**Server → Client Events**:
```typescript
type ServerEvent =
  | { type: 'state'; payload: FullState }
  | { type: 'setlist.updated'; payload: Setlist }
  | { type: 'playback.state'; payload: { isPlaying: boolean; currentTime: number; tempo: number } }
  | { type: 'playback.songChanged'; payload: { song: Song; section?: Section } }
  | { type: 'playback.sectionChanged'; payload: { section: Section } }
  | { type: 'playback.queued'; payload: { songId?: string; sectionId?: string } }
  | { type: 'playback.jumpExecuted'; payload: { from: Position; to: Position } }
  | { type: 'midi.devices'; payload: { inputs: string[]; outputs: string[] } }
  | { type: 'error'; payload: { message: string; code: string } };
```

**Client → Server Actions**:
```typescript
type ClientAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'jump-to-song'; songId: string }
  | { type: 'jump-to-section'; sectionId: string }
  | { type: 'queue-song'; songId: string }
  | { type: 'queue-section'; sectionId: string }
  | { type: 'cancel-queue' }
  | { type: 'setlist.reorder'; order: string[] }
  | { type: 'setlist.remove-song'; songId: string }
  | { type: 'setlist.add-song'; songId: string }
  | { type: 'setlist.save'; name: string }
  | { type: 'setlist.load'; name: string }
  | { type: 'settings.set'; key: string; value: any }
  | { type: 'midi.learn'; mappingId: string }
  | { type: 'midi.add-mapping'; mapping: MidiMapping }
  | { type: 'midi.remove-mapping'; mappingId: string };
```

### 2.9 HTTP API (`src/server/http.ts`)
**Responsibility**: REST endpoints for initial state and file operations.

**Endpoints**:
```
GET  /api/state          → Current full state
GET  /api/setlist        → Current setlist
POST /api/setlist/save   → Save setlist to file
POST /api/setlist/load   → Load setlist from file
GET  /api/songs          → All available songs (from locators)
GET  /api/settings       → Current settings
POST /api/settings       → Update settings
GET  /api/midi/devices   → Available MIDI devices
GET  /api/midi/mappings  → Current MIDI mappings
POST /api/midi/mappings  → Update MIDI mappings
```

### 2.10 Setlist Persistence (`src/storage/setlist.ts`)
**Responsibility**: Save/load setlist files.

**Storage Location**: `~/Documents/AbleSetClone/Setlists/` or project-relative

**File Format**:
```json
{
  "version": 1,
  "name": "Summer Tour 2026",
  "createdAt": "2026-08-05T18:00:00Z",
  "songs": [
    { "songId": "song-abc-123", "overrides": { "color": "red", "stopBehavior": "stop" } }
  ],
  "settings": {
    "jumpMode": "dynamic",
    "autoJump": true
  }
}
```

---

## 3. Frontend Architecture

### 3.1 Views

| View | Purpose | Mobile Optimized |
|------|---------|------------------|
| **Setlist** | Reorder songs, add/remove, see overview | Yes |
| **Performance** | Large buttons, current song, next song, progress | Yes |
| **Sections** | Current song's sections, quick jump | Yes |
| **Settings** | Jump mode, MIDI mapping, general config | Yes |

### 3.2 State Management (Frontend)
```typescript
// Single source of truth from WebSocket
interface AppState {
  connection: 'connected' | 'disconnected' | 'connecting';
  setlist: Setlist;
  playback: {
    isPlaying: boolean;
    currentTime: number;
    tempo: number;
    activeSongId?: string;
    activeSectionId?: string;
    queuedSongId?: string;
    queuedSectionId?: string;
    songProgress: number; // 0-1
    sectionProgress: number; // 0-1
    remainingTime: number; // seconds
  };
  midi: {
    inputs: string[];
    outputs: string[];
    mappings: MidiMapping[];
    learning: boolean;
  };
  settings: AppSettings;
}
```

### 3.3 Mobile-First Design
- Touch targets minimum 48x48dp
- Swipe gestures for song reordering (setlist editor)
- Swipe to remove songs
- Large play/pause buttons
- High contrast for stage visibility
- Prevent screen sleep during performance (via NoSleep.js or Wake Lock API)

---

## 4. Core Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up Node.js/TypeScript project
- [ ] Integrate `ableton-js`, establish connection
- [ ] Build Ableton Bridge module
- [ ] Implement Locator Parser (basic song/section parsing)
- [ ] Build Setlist Engine (read-only from locators)
- [ ] Basic Express + WebSocket server
- [ ] Frontend skeleton with WebSocket client

### Phase 2: Playback Control (Week 2)
- [ ] Play / Pause / Stop with `safeStartPlaying()` / `safeStopPlaying()`
- [ ] Current time tracking via WebSocket
- [ ] Jump to song (immediate)
- [ ] Jump to section (immediate)
- [ ] Active song/section detection from `current_song_time`
- [ ] Progress bars (song + section)
- [ ] **CRITICAL**: Test and verify no "jump to start" bugs

### Phase 3: Jump Modes & Scheduling (Week 3)
- [ ] Implement Jump Engine with state machine
- [ ] Implement Timekeeper with lookahead scheduler
- [ ] Quantized jump mode
- [ ] End-of-Section jump mode
- [ ] End-of-Song jump mode
- [ ] Dynamic jump mode
- [ ] Manual jump mode
- [ ] Queue/cancel UI
- [ ] Stop behavior at song end (auto-jump vs stop)

### Phase 4: Setlist Editor (Week 4)
- [ ] Drag-and-drop reordering
- [ ] Remove songs from setlist (grey out, don't delete)
- [ ] Add songs back (from available pool)
- [ ] Song detail overrides (color, stop behavior)
- [ ] Save/load setlist files
- [ ] Copy/paste setlist (text format)

### Phase 5: MIDI Mapping (Week 5)
- [ ] MIDI input detection (`easymidi`)
- [ ] MIDI learn functionality
- [ ] Map notes/CC/PC to actions
- [ ] "Go" button smart logic
- [ ] Persist mappings to JSON
- [ ] MIDI mapping UI in settings

### Phase 6: Polish & Mobile (Week 6)
- [ ] Responsive CSS for mobile/tablet
- [ ] Performance view (large, stage-friendly)
- [ ] Section view (quick jumps)
- [ ] Prevent screen sleep
- [ ] Network discovery (show IP/hostname)
- [ ] Error handling & reconnection
- [ ] Testing on actual devices

---

## 5. Critical Logic Deep-Dives

### 5.1 Detecting Active Song/Section from Playhead

```typescript
function getActiveSongAndSection(
  currentTime: number,
  setlist: Setlist
): { song?: Song; section?: Section } {
  // Find song: the one whose time range contains currentTime
  const song = setlist.songs.find(s => 
    currentTime >= s.startTime && currentTime < s.endTime
  );

  if (!song) {
    // Could be past last song, or before first
    return { song: undefined, section: undefined };
  }

  // Find section within song
  const section = song.sections.find(sec =>
    currentTime >= sec.startTime && currentTime < sec.endTime
  );

  return { song, section };
}
```

**Edge Cases**:
- Playhead exactly at song boundary → belongs to next song
- Playhead past last song → no active song
- Playhead at section boundary → belongs to next section
- Need tolerance for floating-point comparison (~0.01 beats)

### 5.2 The Quantization Problem

Ableton's `clip_trigger_quantization` property tells us the global quantization:
```typescript
const quant = await ableton.song.get("clip_trigger_quantization");
// Values: q_8_bars, q_4_bars, q_2_bars, q_bar, q_half, q_quarter, etc.
```

When user triggers a jump in **Quantized** mode:
1. Call `cue.jump()` immediately
2. Ableton internally queues it
3. Jump happens at next quantization boundary
4. We must NOT try to calculate when — let Ableton handle it

When user triggers a jump in **End of Section** mode:
1. Mark target as queued
2. Monitor `current_song_time`
3. When approaching section end (within 1 beat), call `targetCue.jump()`
4. Ableton quantizes from that point — should land at section boundary

**Key Insight**: The trick is to call `jump()` slightly BEFORE the boundary so Ableton's quantization lands exactly ON the boundary, not after it.

### 5.3 Loop Handling

When a section has `+LOOP`:
1. When playhead reaches the section's end locator, enable Ableton's loop
2. Loop spans from section start to section end
3. User can "escape loop" → disable loop and continue to next section
4. `+LOOP:4` → count loops, disable after N iterations

```typescript
async function enableLoopForSection(section: Section) {
  await ableton.song.set("loop_start", section.startTime);
  await ableton.song.set("loop_length", section.endTime - section.startTime);
  await ableton.song.set("loop", true);
}

async function escapeLoop() {
  await ableton.song.set("loop", false);
  // If we were at loop end, continue to next section
  // Ableton automatically continues when loop is disabled
}
```

### 5.4 Section Track Support (Alternative to Locators)

For cleaner sessions, support MIDI tracks named "Sections" or with `+SECTIONS` flag:
1. Find track by name
2. Get `arrangement_clips`
3. Each clip = one section
4. Clip name = section name
5. Clip start time = section start
6. Clip end time = section end (or next clip start)

```typescript
async function getSectionsFromTrack(track: Track): Promise<Section[]> {
  const clips = await track.get("arrangement_clips");
  return clips.map((clip, i) => ({
    name: clip.raw.name,
    startTime: clip.raw.start_time,
    endTime: clips[i + 1]?.raw.start_time ?? songEndTime,
    // ...
  }));
}
```

---

## 6. File Structure

```
ableset-clone/
├── src/
│   ├── ableton/
│   │   ├── bridge.ts          # ableton-js wrapper
│   │   └── connection.ts      # Connection lifecycle
│   ├── engine/
│   │   ├── setlist.ts         # Setlist building & management
│   │   ├── jump.ts            # Jump logic & state machine
│   │   ├── timekeeper.ts      # Lookahead scheduler
│   │   └── playback.ts        # Playback state tracking
│   ├── parsers/
│   │   └── locator.ts         # Cue point name parser
│   ├── midi/
│   │   ├── engine.ts          # MIDI I/O
│   │   ├── mappings.ts        # Mapping storage
│   │   └── learn.ts           # MIDI learn mode
│   ├── server/
│   │   ├── http.ts            # Express routes
│   │   └── websocket.ts       # WS handlers
│   ├── storage/
│   │   ├── setlist.ts         # Setlist file I/O
│   │   └── settings.ts        # Settings file I/O
│   ├── types/
│   │   └── index.ts           # All TypeScript interfaces
│   └── index.ts               # Entry point
├── frontend/
│   ├── src/
│   │   ├── views/
│   │   │   ├── SetlistView.ts
│   │   │   ├── PerformanceView.ts
│   │   │   ├── SectionsView.ts
│   │   │   └── SettingsView.ts
│   │   ├── components/
│   │   ├── state/
│   │   │   └── store.ts
│   │   ├── api/
│   │   │   └── websocket.ts
│   │   └── app.ts
│   ├── index.html
│   └── style.css
├── setlists/                  # Saved setlists
├── package.json
└── tsconfig.json
```

---

## 7. Configuration & Settings

```typescript
interface AppSettings {
  // Playback
  jumpMode: 'quantized' | 'end-of-section' | 'end-of-song' | 'dynamic' | 'manual';
  autoJumpToNextSong: boolean;
  alwaysStopOnSongEnd: boolean;
  restartSongBeforeJumpingBack: boolean;
  disableLoopWhenJumping: boolean;

  // MIDI
  midiMappings: MidiMapping[];

  // UI
  defaultView: 'setlist' | 'performance' | 'sections';
  show24HourClock: boolean;

  // Network
  preferredPort: number; // 80 default, fallback 3000+
}
```

---

## 8. Testing Strategy

1. **Unit Tests**: Parser, Timekeeper, Jump Engine logic
2. **Integration Tests**: Ableton Bridge with mock ableton-js
3. **Manual Tests**:
   - Jump to song while playing
   - Jump to song while stopped
   - End-of-section mode with various quantization settings
   - Stop behavior (auto-jump vs stop)
   - MIDI mapping learn + execution
   - Mobile browser connection
   - Project reload (disconnect/reconnect)

---

## 9. Known Ableton Quirks & Mitigations

| Quirk | Mitigation |
|-------|------------|
| `startPlaying()` while playing → jumps to start | Use `safeStartPlaying()` |
| `stopPlaying()` while stopped → jumps to start | Use `safeStopPlaying()` |
| Loading new project → disconnect event | Re-initialize on `connect` event |
| Cue points not on beat grid → quantization issues | Warn user in UI |
| Large project + zoomed out → playhead lag | Not our bug, but document it |
| Windows: only one app can access MIDI input | Disable mapped devices in Live |
| `current_song_time` updates 20-30/sec | Buffer/throttle if needed |
