# GEMINI.md — Frontend Context for AbleSet Clone

> This file provides comprehensive context for AI-assisted frontend development. Feed this to your AI coding assistant before asking it to implement or modify frontend code.

---

## 1. Project Overview

We are building a web-based **Ableton Live setlist controller** that runs as a local web server. Musicians use it on stage from their phones/tablets to control playback, view setlists, and jump between songs and sections.

The backend is a Node.js/TypeScript server that communicates with Ableton Live via `ableton-js` (a UDP-based MIDI Remote Script bridge). The frontend is a web application that connects to this backend via WebSocket and HTTP.

**Key constraint**: This is a **performance tool**. It must work reliably on stage, on mobile devices, with large touch targets, high contrast, and instant feedback.

---

## 2. Tech Stack (Frontend)

- **Language**: TypeScript (ES2023)
- **Build Tool**: Vite (recommended) or your choice
- **Styling**: Plain CSS with CSS custom properties (variables) for theming
- **State**: Lightweight reactive store (no heavy framework required, but React/Vue/Svelte OK)
- **Communication**: Native WebSocket + Fetch API
- **No external UI libraries** unless necessary — keep bundle small and render fast

---

## 3. Domain Models

These are the core data structures flowing from backend to frontend.

### 3.1 Song
```typescript
interface Song {
  id: string;              // Unique identifier
  name: string;            // Display name (from locator)
  description?: string;      // Parsed from {curly braces}
  startTime: number;       // Position in beats (float)
  endTime: number;         // Position in beats
  duration: number;        // Duration in seconds
  color?: string;          // Color name: 'red', 'blue', 'green', etc.
  tags: string[];          // Parsed from #hashtags
  sections: Section[];
  stopBehavior: 'auto-jump' | 'stop' | 'pause' | 'default';
  isNonSong: boolean;    // [nosong] flag
  isSkipped: boolean;    // Removed from active setlist
}
```

### 3.2 Section
```typescript
interface Section {
  id: string;
  name: string;
  description?: string;
  startTime: number;       // beats
  endTime: number;         // beats
  duration: number;        // seconds
  color?: string;
  flags: {
    pause: boolean;        // +PAUSE
    loop: boolean;         // +LOOP
    loopFull: boolean;     // +LOOPFULL
    loopCount?: number;    // +LOOP:4
    skip: boolean;         // +SKIP
    end: boolean;          // +END
    quickJump: boolean;    // >>
  };
  transitionTarget?: string; // >>> TargetSection
}
```

### 3.3 Setlist
```typescript
interface Setlist {
  songs: Song[];           // All available songs (from project locators)
  order: string[];         // Ordered song IDs (active setlist)
  activeSongId?: string;
  activeSectionId?: string;
  queuedSongId?: string;   // For jump modes that queue
  queuedSectionId?: string;
  isPlaying: boolean;
  currentTime: number;     // Current playhead in beats
  tempo: number;
  totalDuration: number;   // Sum of active song durations
  remainingTime: number;   // Remaining in entire set
}
```

### 3.4 Playback State
```typescript
interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;       // !isPlaying && currentTime > 0
  currentTime: number;     // beats
  tempo: number;
  activeSongId?: string;
  activeSectionId?: string;
  queuedSongId?: string;
  queuedSectionId?: string;
  songProgress: number;    // 0.0 to 1.0
  sectionProgress: number; // 0.0 to 1.0
  isLooping: boolean;
  isCountingIn: boolean;
  remainingTimeInSong: number;  // seconds
  remainingTimeInSet: number;   // seconds
}
```

### 3.5 App Settings
```typescript
interface AppSettings {
  jumpMode: 'quantized' | 'end-of-section' | 'end-of-song' | 'dynamic' | 'manual';
  autoJumpToNextSong: boolean;
  alwaysStopOnSongEnd: boolean;
  restartSongBeforeJumpingBack: boolean;
  disableLoopWhenJumping: boolean;
  defaultView: 'setlist' | 'performance' | 'sections';
  show24HourClock: boolean;
}
```

### 3.6 MIDI Mapping
```typescript
interface MidiMapping {
  id: string;
  inputName: string;       // MIDI port name
  messageType: 'note-on' | 'note-off' | 'cc' | 'pc';
  channel: number;         // 1-16
  note?: number;           // 0-127
  cc?: number;             // 0-127
  value?: number;          // Specific value or undefined for "any"
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
  | { type: 'go' }          // Smart multi-function button
  | { type: 'cancel-queue' };
```

---

## 4. API Contract

### 4.1 WebSocket Protocol

The frontend opens a WebSocket to `ws://{host}:{port}/ws`.

**Server → Client Events** (JSON):

```typescript
// Full state snapshot (sent on connect and on major changes)
{ type: "state", payload: { setlist: Setlist, playback: PlaybackState, settings: AppSettings } }

// Playback updates (high frequency, ~10-30/sec when playing)
{ type: "playback.tick", payload: { currentTime: number, songProgress: number, sectionProgress: number, remainingTimeInSong: number } }

// Song/section changes
{ type: "playback.songChanged", payload: { songId: string, previousSongId?: string } }
{ type: "playback.sectionChanged", payload: { sectionId: string, previousSectionId?: string } }

// Queue state
{ type: "playback.queued", payload: { songId?: string, sectionId?: string } }
{ type: "playback.queueCleared", payload: {} }

// Setlist changes
{ type: "setlist.updated", payload: Setlist }
{ type: "setlist.saved", payload: { name: string } }

// MIDI
{ type: "midi.devices", payload: { inputs: string[], outputs: string[] } }
{ type: "midi.learning", payload: { mappingId: string } } // Started learning
{ type: "midi.learned", payload: { mappingId: string, mapping: MidiMapping } }

// Errors
{ type: "error", payload: { message: string, code: string } }
```

**Client → Server Actions** (JSON):

```typescript
// Playback control
{ type: "play" }
{ type: "pause" }
{ type: "stop" }

// Jumps (immediate in quantized mode, queued in other modes)
{ type: "jump-to-song", songId: string }
{ type: "jump-to-section", sectionId: string }

// Queue (for end-of-section/song/dynamic/manual modes)
{ type: "queue-song", songId: string }
{ type: "queue-section", sectionId: string }
{ type: "cancel-queue" }

// Setlist editing
{ type: "setlist.reorder", order: string[] }
{ type: "setlist.remove-song", songId: string }    // Grey out / skip
{ type: "setlist.restore-song", songId: string }   // Add back
{ type: "setlist.save", name: string }
{ type: "setlist.load", name: string }

// Settings
{ type: "settings.set", key: string, value: any }

// MIDI
{ type: "midi.learn", mappingId: string }
{ type: "midi.add-mapping", mapping: MidiMapping }
{ type: "midi.remove-mapping", mappingId: string }
```

### 4.2 HTTP Endpoints

```
GET  /api/state              → { setlist, playback, settings, midi }
GET  /api/setlist           → Setlist
POST /api/setlist/save      → body: { name, order }
POST /api/setlist/load      → body: { name }
GET  /api/setlist/files     → string[] (saved setlist names)
GET  /api/settings          → AppSettings
POST /api/settings          → body: AppSettings
GET  /api/midi/devices      → { inputs: string[], outputs: string[] }
GET  /api/midi/mappings     → MidiMapping[]
POST /api/midi/mappings     → body: MidiMapping[]
```

---

## 5. State Management Pattern

Use a lightweight reactive store. Here's the conceptual pattern:

```typescript
// store.ts
class Store {
  private state: AppState;
  private listeners: Set<(state: AppState) => void> = new Set();
  private ws: WebSocket;

  constructor() {
    this.state = getInitialState();
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(`ws://${window.location.host}/ws`);
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
  }

  private handleMessage(msg: ServerEvent) {
    switch (msg.type) {
      case 'state':
        this.state = { ...this.state, ...msg.payload };
        break;
      case 'playback.tick':
        this.state.playback = { ...this.state.playback, ...msg.payload };
        break;
      case 'playback.songChanged':
        this.state.playback.activeSongId = msg.payload.songId;
        // Trigger haptic feedback on mobile
        if (navigator.vibrate) navigator.vibrate(50);
        break;
      // ... etc
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.state));
  }

  subscribe(callback: (state: AppState) => void): () => void {
    this.listeners.add(callback);
    callback(this.state); // Immediate call with current state
    return () => this.listeners.delete(callback);
  }

  // Actions
  play() { this.ws.send(JSON.stringify({ type: 'play' })); }
  pause() { this.ws.send(JSON.stringify({ type: 'pause' })); }
  jumpToSong(songId: string) { this.ws.send(JSON.stringify({ type: 'jump-to-song', songId })); }
  queueSong(songId: string) { this.ws.send(JSON.stringify({ type: 'queue-song', songId })); }
  cancelQueue() { this.ws.send(JSON.stringify({ type: 'cancel-queue' })); }
  reorderSetlist(order: string[]) { this.ws.send(JSON.stringify({ type: 'setlist.reorder', order })); }
  removeSong(songId: string) { this.ws.send(JSON.stringify({ type: 'setlist.remove-song', songId })); }
  restoreSong(songId: string) { this.ws.send(JSON.stringify({ type: 'setlist.restore-song', songId })); }
  setSetting(key: string, value: any) { this.ws.send(JSON.stringify({ type: 'settings.set', key, value })); }
  startMidiLearn(mappingId: string) { this.ws.send(JSON.stringify({ type: 'midi.learn', mappingId })); }
}

export const store = new Store();
```

---

## 6. Views & UI Specification

### 6.1 Setlist View

**Purpose**: Overview of all songs, reordering, adding/removing.

**Layout**:
```
┌─────────────────────────────┐
│  Setlist Name          [⚙] │  ← Header
├─────────────────────────────┤
│  1. Song One          [≡] [x]│  ← Draggable items
│  2. Song Two          [≡] [x]│    (handle on left)
│  3. Song Three        [≡] [x]│
│     > Verse 1               │  ← Sections indented
│     > Chorus                │
│  4. ─── Interlude ───       │  ← Non-song, styled differently
├─────────────────────────────┤
│  [+] Add Song          42:15 │  ← Bottom bar
│         Total Duration       │
└─────────────────────────────┘
```

**Interactions**:
- **Tap song**: Jump to song (or queue, depending on jump mode)
- **Long press / drag handle**: Reorder
- **Swipe left**: Remove (grey out)
- **Tap [+]**: Open song picker (searchable list of all available songs)
- **Tap [⚙]**: Open settings

**Visual States**:
- Active song: Highlighted with its color, bold text
- Played songs: Dimmed/greyed
- Queued song: Pulsing border or highlight
- Skipped songs: Hidden by default, toggle with "Show skipped" button

### 6.2 Performance View

**Purpose**: Stage-optimized large display for the current song.

**Layout**:
```
┌─────────────────────────────┐
│  21:45          🔋 85%      │  ← Clock + battery (if from mobile)
├─────────────────────────────┤
│                             │
│    NOW PLAYING              │
│                             │
│    ┌─────────────────┐      │
│    │                 │      │
│    │   SONG NAME     │      │  ← Massive text
│    │   {Description} │      │
│    │                 │      │
│    └─────────────────┘      │
│                             │
│    [==========>    ]  3:20  │  ← Progress bar
│                             │
│    Next: Song Two           │
│                             │
├─────────────────────────────┤
│  [⏮]  [⏯]  [⏹]  [⏭]  [GO]│  ← Transport
└─────────────────────────────┘
```

**Interactions**:
- All buttons minimum 64x64dp touch targets
- **Play/Pause**: Toggle playback
- **Stop**: Stop playback
- **Prev/Next Song**: Jump to previous/next
- **GO Button**: Smart action (see below)

**GO Button Logic** (displayed prominently):
- If stopped at song end → "Next Song" icon
- If stopped inside song → "Play" icon
- If playing in loop → "Escape Loop" icon
- If playing with queued jump → "Jump Now" icon

### 6.3 Sections View

**Purpose**: Quick access to sections within the current song.

**Layout**:
```
┌─────────────────────────────┐
│  Current Song Name     [↩]  │
├─────────────────────────────┤
│  [ Intro        ] 3:20      │
│  [ Verse 1      ] 2:15 ←── │  ← Active section highlighted
│  [ Chorus       ] 1:45      │
│  [ Verse 2      ] 2:15      │
│  [ Bridge       ] 2:00      │
│  [ Chorus (Final)] 1:45     │
│  [ Outro        ] 1:30      │
└─────────────────────────────┘
```

**Interactions**:
- **Tap section**: Jump to section (or queue)
- Active section: Highlighted with color
- Queued section: Pulsing
- Skipped sections (`+SKIP`): Greyed out, non-interactive
- `>>` sections: Slightly larger or marked as "quick access"

### 6.4 Settings View

**Sections**:
1. **Playback**
   - Jump Mode: Radio buttons (Quantized, End of Section, End of Song, Dynamic, Manual)
   - Auto-jump to next song: Toggle
   - Always stop at song end: Toggle
   - Restart song before jumping back: Toggle

2. **MIDI Mapping**
   - List of current mappings
   - "Learn" button per mapping
   - "Add Mapping" button
   - MIDI device selector

3. **Display**
   - Default view selector
   - 24-hour clock toggle

4. **Connection**
   - Show current IP/hostname
   - QR code for quick mobile connection

---

## 7. UI/UX Patterns

### 7.1 Colors

Use a predefined palette mapped from Ableton's color indices:

```css
:root {
  --color-red: #ff5252;
  --color-orange: #ff9800;
  --color-amber: #ffc107;
  --color-yellow: #ffeb3b;
  --color-lime: #cddc39;
  --color-green: #4caf50;
  --color-emerald: #009688;
  --color-teal: #00bcd4;
  --color-cyan: #03a9f4;
  --color-sky: #2196f3;
  --color-blue: #3f51b5;
  --color-indigo: #673ab7;
  --color-violet: #9c27b0;
  --color-purple: #e91e63;
  --color-fuchsia: #ff4081;
  --color-pink: #ff80ab;
  --color-rose: #ff1744;
  --color-gray: #9e9e9e;

  --bg-primary: #121212;
  --bg-secondary: #1e1e1e;
  --bg-tertiary: #2d2d2d;
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
  --accent: #00e676;
}
```

### 7.2 Touch Targets
- Minimum 48x48dp for all interactive elements
- Primary actions (Play, GO): 64x64dp minimum
- Drag handles: 44x44dp with 20dp padding

### 7.3 Feedback
- **Haptic feedback** on song/section change (if supported)
- **Visual flash** on button press (active state)
- **Toast notifications** for errors ("Connection lost", "Jump failed")
- **Queue indicator**: Pulsing animation on queued item

### 7.4 Responsive Breakpoints
```css
/* Mobile (phones) */
@media (max-width: 480px) { }

/* Tablet */
@media (min-width: 481px) and (max-width: 1024px) { }

/* Desktop */
@media (min-width: 1025px) { }
```

### 7.5 Prevent Screen Sleep
```typescript
// On performance view activation
async function keepScreenAwake() {
  try {
    const wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      console.log('Screen wake lock released');
    });
  } catch (err) {
    // Fallback to NoSleep.js or video trick
  }
}
```

---

## 8. Jump Mode UI Behaviors

The UI must adapt based on the active `jumpMode`:

| Jump Mode | Tap Song Behavior | Tap Section Behavior | Queue UI |
|-----------|-------------------|---------------------|----------|
| **Quantized** | Immediate jump (Ableton quantizes) | Immediate jump | None |
| **End of Section** | Queue song, jump at section end | Queue section, jump at section end | Show "Queued" badge + Cancel button |
| **End of Song** | Queue song, jump at song end | Queue section, jump at song end | Show "Queued" badge + Cancel button |
| **Dynamic** | Queue song, jump at song end | Queue section, jump at section end | Show "Queued" badge + Cancel button |
| **Manual** | Queue song, jump on manual trigger | Queue section, jump on manual trigger | Show "Queued" badge + "Jump Now" button |

**Queue UI Component**:
```
When something is queued:
┌─────────────────────────────┐
│  ⏳ Jumping to: Song Name   │
│  [Cancel]  [Jump Now]       │
└─────────────────────────────┘
```

---

## 9. Setlist Editor Behaviors

### 9.1 Reordering
- Use native HTML5 drag-and-drop or a library like SortableJS
- On drop: send `setlist.reorder` with new ID array
- Visual: Semi-transparent ghost during drag

### 9.2 Removing/Restoring
- Swipe left on mobile → reveal "Remove" button
- On desktop: Click `x` button
- Removed songs grey out but stay in DOM (for easy restore)
- "Hide Skipped" toggle to clean up view

### 9.3 Adding Songs
- Tap `[+]` → Slide-up panel with searchable list
- Search filters by name, description, tags
- Tap song → Added to end of setlist
- "Add all with tag #rock" option

### 9.4 Song Details
- Tap three-dot menu → Popover with:
  - Color picker
  - Stop behavior override (dropdown)
  - Description editor
  - Duration override

---

## 10. Error Handling

**Connection Lost**:
- Show full-screen overlay: "Connection to Ableton lost"
- Auto-retry WebSocket every 3 seconds
- Show "Reconnecting..." spinner

**Jump Failed**:
- Toast: "Unable to jump — playback may be stopped"
- Log to console for debugging

**MIDI Device Disconnected**:
- Grey out mappings for that device
- Show warning in settings

---

## 11. File Structure (Frontend)

```
frontend/
├── src/
│   ├── main.ts                 # Entry point
│   ├── store.ts                # Reactive state store
│   ├── api.ts                  # WebSocket + HTTP wrappers
│   ├── types.ts                # All TypeScript interfaces
│   ├── utils/
│   │   ├── formatTime.ts       # Beat → mm:ss conversion
│   │   ├── colors.ts           # Color name → CSS color
│   │   └── dom.ts              # DOM helpers
│   ├── views/
│   │   ├── SetlistView.ts      # Setlist editor
│   │   ├── PerformanceView.ts  # Stage view
│   │   ├── SectionsView.ts     # Section quick-jump
│   │   └── SettingsView.ts     # Configuration
│   ├── components/
│   │   ├── SongItem.ts         # Song row component
│   │   ├── SectionItem.ts      # Section button
│   │   ├── ProgressBar.ts      # Progress indicator
│   │   ├── TransportControls.ts # Play/Stop/Prev/Next
│   │   ├── QueueIndicator.ts   # Queued jump banner
│   │   ├── MidiMappingRow.ts   # MIDI mapping editor row
│   │   └── Toast.ts            # Notification toast
│   └── styles/
│       ├── variables.css       # CSS custom properties
│       ├── base.css            # Reset + base styles
│       ├── components.css      # Component styles
│       └── views.css           # View-specific styles
├── index.html
└── vite.config.ts
```

---

## 12. Key Implementation Notes

### 12.1 Beat Time → Human Time
```typescript
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function beatsToSeconds(beats: number, tempo: number): number {
  return (beats / tempo) * 60;
}
```

### 12.2 Progress Calculation
```typescript
function getProgress(current: number, start: number, end: number): number {
  if (end <= start) return 0;
  const progress = (current - start) / (end - start);
  return Math.max(0, Math.min(1, progress));
}
```

### 12.3 Color Mapping
Ableton uses color indices (0-69). Map these to CSS color names:
```typescript
const abletonColorMap: Record<number, string> = {
  0: 'red', 1: 'orange', 2: 'yellow', 3: 'green', 
  // ... etc
};
```

### 12.4 Mobile Considerations
- Use `touch-action: manipulation` to prevent double-tap zoom
- Use `-webkit-tap-highlight-color: transparent`
- Lock orientation to portrait on phones (optional)
- Use `viewport-fit=cover` for edge-to-edge on modern phones

---

## 13. Testing Checklist (Frontend)

- [ ] WebSocket reconnects automatically
- [ ] Setlist reordering persists after refresh
- [ ] Tap song jumps correctly in all 5 jump modes
- [ ] Queue UI appears/disappears correctly
- [ ] Progress bar updates smoothly (requestAnimationFrame)
- [ ] Transport buttons work on touch devices
- [ ] Settings persist to backend
- [ ] MIDI learn UI shows correct feedback
- [ ] Screen stays awake in Performance view
- [ ] Works on iOS Safari and Android Chrome
