# AbleSet Clone — Ableton Live Setlist Controller

A web-based setlist controller for **Ableton Live** designed for live stage performances. Musicians and sound engineers can view setlists, reorder songs, jump between sections, trigger smart GO actions, and map MIDI pedalboards directly from any phone, tablet, or laptop on stage.

---

## 🚀 Features

- **Stage-Optimized UI**: High contrast, bold typography, large touch targets (minimum 48×48dp, GO button 72px+), responsive for phones, tablets, and desktops.
- **5 Jump Modes**:
  - **Quantized**: Immediate jump, letting Ableton quantize naturally on the beat grid.
  - **End of Section**: Queues target; triggers jump pre-activation when current section finishes.
  - **End of Song**: Queues target; triggers jump pre-activation when current song finishes.
  - **Dynamic**: Auto-detects section vs song targets.
  - **Manual**: Queues target until manual GO button press or playback stop.
- **Pre-Activation Jump Engine**: Triggers Ableton locators `~50–100ms` ahead of musical boundaries so Live's internal quantization lands precisely on beat 1 bar 1.
- **Arrangement Protection**: Uses `safeStartPlaying()` and `safeStopPlaying()` wrappers to completely prevent Ableton arrangement jump-to-start bugs.
- **Setlist Editor**: Drag-and-drop song reordering, soft skip/restore, song detail overrides (color & stop behavior), plain text copy/import.
- **MIDI Controller Engine**: Full MIDI Learn support for Notes, CC, and Program Changes (`easymidi`).
- **Screen Wake Lock**: Prevents phone screens from sleeping during live sets (`navigator.wakeLock`).
- **Network Discovery**: Automatic Wi-Fi LAN IP display for quick mobile pairing.

---

## 🎛️ How to Set Up Your Ableton Live Project

This controller reads Ableton Live's arrangement **Cue Points (Locators)** and parses AbleSet-style notation to construct your setlist.

### 1. Locator Naming Rules

In Ableton Live, create arrangement locators using the following naming conventions:

| Locator Name Example | Meaning / Behavior |
|----------------------|--------------------|
| `Never Gonna Give You Up` | **Song Start**: Defines the beginning of a song. |
| `> Verse 1` | **Section**: Defines a section inside the preceding song. |
| `>> Chorus` | **Quick Access Section**: Highlighted for fast stage jumping. |
| `{Key: C, Capo 1}` | **Description**: Adds metadata shown in curly braces. |
| `#rock #live` | **Hashtag Tags**: Enables tag filtering in the song picker. |
| `[3:45]` or `[225s]` | **Duration Override**: Overrides calculated song duration. |
| `[blue]` or `[red]` | **Color Override**: Assigns card accent color. |
| `SONG END` | **Song End**: Marks end of song and auto-jumps to next song. |
| `STOP` or `AUTOSTOP` | **Stop Marker**: Halts playback automatically at song end. |
| `> Intro +LOOP` | **Loop Section**: Enables Ableton loop for this section. |
| `> Bridge +LOOP:4` | **Counted Loop**: Loops section exactly 4 times. |
| `> Outro +PAUSE` | **Pause Flag**: Pauses playhead at locator. |
| `* Scratch Pad` | **Ignored Locator**: Locators starting with `*` are omitted. |
| `[nosong]` | **Non-Song Item**: E.g. `Interlude [nosong]` (not counted in song numbers). |

#### Example Arrangement Layout:
```text
[0.0.0]  Follow Night {Capo 2} #rock [blue]
[16.0.0] > Intro
[32.0.0] >> Chorus +LOOP
[64.0.0] > Outro
[80.0.0] SONG END
[96.0.0] Acoustic Song {Tuning: DADGAD}
[128.0]  STOP
```

---

### 2. Setting Up `ableton-js` Remote Script in Ableton Live

The backend communicates with Ableton Live via UDP using `ableton-js`'s MIDI Remote Script.

#### Step 1: Install the MIDI Remote Script
1. Locate your Ableton Live **MIDI Remote Scripts** directory:
   - **macOS**: `/Applications/Ableton Live [Version].app/Contents/App-Resources/MIDI Remote Scripts/`
   - **Windows**: `C:\ProgramData\Ableton\Live [Version]\Resources\MIDI Remote Scripts\`
2. Download or copy the `AbletonJS` folder from [ableton-js-midi-script](https://github.com/leoluca/ableton-js-midi-script).
3. Place the `AbletonJS` folder inside the `MIDI Remote Scripts` directory.

#### Step 2: Enable in Ableton Live Preferences
1. Open Ableton Live.
2. Go to **Preferences** -> **Link / Tempo / MIDI**.
3. Under **Control Surface**, select **AbletonJS** from the dropdown menu.
4. Set **Input** and **Output** to `None` (the script communicates internally via UDP loopback port `9001`).

---

## 🛠️ Quick Start & Installation

### Prerequisites
- **Node.js**: v20.0.0 or higher (v22 recommended)
- **npm**: v10.0.0 or higher
- **Ableton Live**: 10, 11, or 12 with `AbletonJS` Remote Script enabled

### Installation

```bash
# Clone repository
git clone https://github.com/joohnnyvv/alive-set-manager.git
cd alive-set-manager

# Install dependencies
npm install
```

### Running the App

```bash
# Start backend server & frontend Vite dev server concurrently
npm run dev
```

Output:
```text
==================================================
 AbleSet Controller Server running on port 8080
 Local access: http://localhost:8080
 Mobile access: http://192.168.1.100:8080
==================================================
```

Open **`http://localhost:8080`** on your computer, or **`http://<YOUR_LOCAL_IP>:8080`** on phones/tablets connected to the same Wi-Fi network.

---

## 📜 NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Runs backend (with auto-reload) and Vite frontend concurrently. |
| `npm run build` | Compiles backend TypeScript and builds production frontend bundle (`dist/`). |
| `npm test` | Runs the automated Node test suite (20 tests covering parser, setlist engine, jump modes, MIDI, and safety guards). |
| `npm run typecheck` | Runs `tsc --noEmit` to verify strict TypeScript compilation. |

---

## 🧪 Testing

The project includes an automated unit and integration test suite:

```bash
npm test
```

Tests cover:
- Locator parser & metadata extraction
- Setlist engine & playhead boundary detection
- Lookahead timekeeper scheduler & jump state machine
- Jump modes & pre-activation timing
- Song stop behaviors (`auto-jump`, `stop`, `pause`)
- Setlist JSON persistence & plain text import/export
- MIDI Engine & Smart GO Button logic
- Code audit ensuring zero raw `startPlaying()` / `stopPlaying()` calls exist

---

## 📱 Mobile Stage Tips

1. **Keep Screen Awake**: Go to **Settings** view in the web app and click **Enable Screen Lock** (`navigator.wakeLock`).
2. **Add to Home Screen**: On iOS Safari or Android Chrome, select "Add to Home Screen" for full-screen PWA mode.
3. **Stage High Contrast**: The interface automatically defaults to stage high-contrast dark theme with color-coded section tiles.

---

## 📄 License

ISC License.
