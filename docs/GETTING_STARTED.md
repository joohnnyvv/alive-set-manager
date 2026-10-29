# Getting started

Install the matching desktop download, then open Help. Setup can be skipped and reopened from Help or Settings.

## AbletonJS

The application includes the script matching its pinned `ableton-js` version. The default library is `~/Music/Ableton/User Library` on macOS or the current user’s Documents/Ableton/User Library on Windows. The native picker handles custom and redirected locations.

Install into `Remote Scripts/AbletonJS` inside that library. Confirm the destination. Identical files are left alone; a changed script is backed up in `Alive Set Manager Backups` before replacement. Python cache files do not trigger unnecessary replacements. If installation fails, inspect the error and leave the previous script in place. Live is never restarted for you.

In Live 12 choose AbletonJS under Settings → Link, Tempo & MIDI → Control Surface. Input and Output are None. Restart Live if it is absent. The current protocol discovers local UDP ports; do not configure the obsolete fixed-port instructions from older versions of this project.

## Locator reference

| Name | Meaning |
| --- | --- |
| `Northern Lights` | Begin a song |
| `> Verse` | Section in the preceding song |
| `>> Chorus` | Quick-access section |
| `> Chorus {F#m D A E}` | Section chords |
| `Song {Key: D} #acoustic [blue]` | Description, tag and color |
| `Song [3:45]` | Duration override |
| `SONG END` | Song boundary |
| `STOP` | Stop at song boundary |
| `> Bridge +LOOP` / `+LOOP:2` | Loop / counted loop |
| `> Break +PAUSE` | Pause on section entry |
| `* Production note` | Ignore locator |

Not every syntax mentioned in old design notes is supported. Sections come from arrangement locators, not a separate Sections track. Try transitions in rehearsal before performance.

## Running order, transport and MIDI

Setlist reorders songs without moving Live’s audio. Duplicates refer to the same underlying musical material. Skip keeps an entry available for restoration. Save/load preserves the named running order and overrides; audio remains in your Live set.

Stage View shows transport and the contextual GO label. Quantized jumps immediately; section/song modes queue to boundaries; Dynamic uses the target type; Manual waits for GO or playback stopping. Cancel clears the queue. MIDI Learn in Settings binds a device message to the selected action. Refresh devices after reconnection.

## Recovery and support

The application stores data in the OS application-data folder under Alive Set Manager. On first normal startup it copies valid legacy `.ableset` data without deleting the source or replacing existing new data. Corrupt files are retained and errors are reported. `migration-v1.json` records skipped legacy files.

For connection problems distinguish the app/WebSocket status from Live status. Confirm Control Surface selection, script version, and that Live is open. For an empty setlist create song locators. For LAN access enable it, restart, and check firewall and Wi-Fi. For updates use Help; downloads never restart playback.

Export diagnostics from Help and attach them to an issue if useful. The export includes versions, platform and connection state, not tokens, personal paths, or song names. Nothing is uploaded automatically.
