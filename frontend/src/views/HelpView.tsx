import { createSignal, onMount, Show } from 'solid-js';
import { store } from '../state/store.js';
import type { ScriptStatus, UpdateResult } from '../../../src/desktop/contracts.js';

export default function HelpView() {
  const [version, setVersion] = createSignal('0.1.0-alpha.1');
  const [status, setStatus] = createSignal<ScriptStatus>();
  const [message, setMessage] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [update, setUpdate] = createSignal<UpdateResult>();
  const [licenses, setLicenses] = createSignal('');
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  onMount(() => { if (window.desktop) void run(async () => { setVersion((await window.desktop!.info()).version); setStatus(await window.desktop!.scriptStatus()); }); });
  return <div class="help-view">
    <div class="help-heading"><span class="eyebrow">ALIVE SET MANAGER · ALPHA</span><h1>Ready for your next set.</h1><p>Setup, reference, and support. All essential help stays available offline.</p></div>
    <p class="connection-summary" role="status">App: {store.connection} · Ableton Live: {store.liveConnected ? 'connected' : 'not connected'}{store.liveConnected && !store.setlist.songs.length ? ' · No song locators found' : ''}</p>
    <Show when={message()}><p role="alert" class="help-message">{message()}</p></Show>
    <section class="settings-card" aria-labelledby="setup-heading"><h2 id="setup-heading">1. Connect Ableton Live 12</h2>
      <p>Install the bundled AbletonJS Remote Script in your Ableton User Library. In Live, open Settings → Link, Tempo & MIDI, choose <strong>AbletonJS</strong> in a Control Surface slot, and set Input and Output to <strong>None</strong>. Restart Live if the script is not listed.</p>
      <Show when={window.desktop} fallback={<p>Open the desktop application to install or repair the script. Mobile browsers control the connected desktop app.</p>}>
        <Show when={status()}>{s => <><p>Bundled version: <strong>{s().bundledVersion}</strong> · Installed: <strong>{s().installedVersion || 'not detected'}</strong> · {s().state === 'current' ? 'Up to date' : s().state === 'different' ? 'Replacement available' : 'Not installed'}</p><p class="help-path">{s().destination}</p></>}</Show>
        <div class="help-actions"><button class="btn" disabled={busy()} onClick={() => void run(async () => { const result = await window.desktop!.chooseLibrary(); if (result) setStatus(result); })}>Choose User Library</button>
        <button class="btn btn-primary" disabled={busy() || status()?.state === 'current'} onClick={() => void run(async () => { const result = await window.desktop!.installScript(); if (result) { setStatus(result); setMessage('Script installed. Select AbletonJS in Live, then check the connection above.'); } })}>Install / repair script</button>
        <button class="btn" disabled={busy()} onClick={() => void run(async () => { await window.desktop!.finishSetup(); setMessage('Setup dismissed. You can return here at any time from Help or Settings.'); })}>Done / skip setup</button></div>
      </Show>
      <p>Default libraries: macOS <code>~/Music/Ableton/User Library</code>; Windows <code>Documents\Ableton\User Library</code>. Choose your actual location if moved or stored in OneDrive. Existing replacements are backed up in the library’s Alive Set Manager Backups folder.</p>
    </section>
    <section class="settings-card"><h2>2. Describe your arrangement</h2><p>Each song begins with a named locator; prefix sections with <code>&gt;</code> or quick-access sections with <code>&gt;&gt;</code>. Put each locator at its intended arrangement position.</p>
      <pre>{'Northern Lights {Key: F#m} [blue]\n> Intro {F#m D A E}\n>> Chorus {F#m D A E}\n> Bridge +LOOP:2\n> Outro\nSONG END\nPaper Satellites\n> Verse {C G Am F}\nSTOP'}</pre>
      <p><code>SONG END</code> closes a song. <code>STOP</code> stops at the boundary. <code>+PAUSE</code> pauses on section entry; <code>+LOOP</code> repeats a section; <code>+LOOP:2</code> counts passes. Locators starting with <code>*</code> are ignored. Use original song names for shared demo sets.</p>
    </section>
    <section class="settings-card"><h2>3. Perform and save</h2><p>Setlist edits the running order. Stage View emphasizes the current section and chords. Sections shows navigation targets. Save a named setlist before quitting; load it after reopening the corresponding Live project. Setlist files do not contain audio or replace your Live project.</p>
      <p><strong>Jump modes:</strong> Quantized requests a jump immediately using Live’s quantization. End of Section and End of Song queue until that boundary. Dynamic chooses the boundary from the target. Manual waits for GO or playback stopping. Cancel clears a queued jump.</p>
      <p><strong>GO</strong> performs the displayed action: start, execute a queued target, leave a loop, or advance. Pause preserves your position. Stop and next/previous commands control Live—rehearse transitions before using an alpha on stage.</p>
      <p><strong>MIDI Learn:</strong> In Settings add a mapping, select its action, click Learn, then press the controller. Refresh devices after reconnecting. Mappings persist separately from setlists.</p>
    </section>
    <section class="settings-card"><h2>Network and troubleshooting</h2><p>LAN access is off by default. Enable it in Settings and restart the app, then connect your phone to the same trusted Wi-Fi and scan the QR code. Allow local network access in your OS firewall. Do not expose this server to the internet.</p><p>An app connection does not mean Live is connected. If Live is offline, confirm the script, Control Surface slot, and Live version. If the setlist is empty, add song locators. Reopen Live after updating the script. A blocked save or startup error leaves original data available for recovery.</p><p>This alpha is not notarized on macOS or publisher-signed on Windows. Follow your OS’s documented approval flow only for a download you trust. Live 11, Linux, physical-device combinations, and secure-context-dependent mobile wake lock are not certified.</p></section>
    <section class="settings-card"><h2>About & updates</h2><p>Alive Set Manager {version()} · ISC license · Independent project, not affiliated with Ableton or AbleSet.</p><p>Uses AbletonJS by Leo Bernard and other open-source software. Updates are checked only when requested. Alpha updates are downloaded and installed manually; playback is never restarted automatically.</p>
      <Show when={window.desktop} fallback={<p>Check for updates and export diagnostics from the desktop app.</p>}><div class="help-actions">
        <button class="btn" disabled={busy()} onClick={() => void run(async () => setUpdate(await window.desktop!.checkUpdates()))}>Check for updates</button>
        <button class="btn" onClick={() => void run(() => window.desktop!.openLink('releases'))}>Release notes</button>
        <button class="btn" onClick={() => void run(() => window.desktop!.openLink('issues'))}>Report an issue</button>
        <button class="btn" onClick={() => void run(async () => { if (await window.desktop!.diagnostics()) setMessage('Diagnostics exported. No tokens, personal paths, or song names included.'); })}>Export diagnostics</button>
        <button class="btn" onClick={() => void run(async () => setLicenses(await window.desktop!.licenses()))}>Third-party licenses</button>
        <button class="btn" onClick={() => void run(() => window.desktop!.openLink('ableton-js'))}>About AbletonJS</button>
      </div></Show>
      <Show when={update()}>{u => <div role="status"><p>{u().status === 'current' ? 'You are up to date.' : u().message || `Available: ${u().version}`}</p><Show when={u().status === 'available'}><button class="btn btn-primary" onClick={() => void run(() => window.desktop!.openLink('download'))}>Download update</button><pre>{u().notes}</pre></Show></div>}</Show>
      <p><a href="/licenses/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">Open-source notices</a> · <a href="/licenses/LICENSES.chromium.html" target="_blank" rel="noreferrer">Chromium licenses</a></p>
      <Show when={licenses()}><details open><summary>Third-party license notices</summary><pre class="license-text">{licenses()}</pre></details></Show>
    </section>
  </div>;
}
