import { createSignal, For, Show, onMount } from 'solid-js';
import { store, dispatch, applyTheme, setView } from '../state/store.js';
import { showToast } from '../components/Toast.js';
import { apiFetch, getAuthToken } from '../api/http.js';
import type { AppTheme, JumpMode, MidiAction, MidiMapping } from '../types.js';
import QRCodeStylingPkg from 'qr-code-styling';
const QRCodeStyling: any = (QRCodeStylingPkg as any).default || QRCodeStylingPkg;

export default function SettingsView() {
  let qrRef: HTMLDivElement | undefined;
  const [ips, setIps] = createSignal<string[]>([]);
  const [serverPort, setServerPort] = createSignal(8080);
  const [showAddMidiModal, setShowAddMidiModal] = createSignal(false);
  const [midiActionType, setMidiActionType] = createSignal('go');
  const [wakeLockActive, setWakeLockActive] = createSignal(false);

  const themes: { id: AppTheme; name: string; desc: string }[] = [
    { id: 'midnight', name: 'Midnight Studio', desc: 'Toned dark mode with slate tones & emerald accents.' },
    { id: 'live-dark', name: 'Ableton Live Dark', desc: 'Warm black and ivory with vermilion accents for the stage.' },
    { id: 'live-light', name: 'Ableton Live Light', desc: 'Light gray theme for bright daylight or outdoor festival stages.' },
    { id: 'high-contrast', name: 'High Contrast Stage', desc: 'Pitch black background with neon lime accents & bold borders.' },
    { id: 'soft-dark', name: 'Soft Dark', desc: 'Low-contrast dark theme with muted tones and zero sharp flare.' },
  ];

  const jumpModes: { id: JumpMode; label: string; desc: string }[] = [
    { id: 'quantized', label: 'Quantized', desc: 'Jump immediately, letting Ableton quantize naturally.' },
    { id: 'end-of-section', label: 'End of Section', desc: 'Queue target, jump smoothly when current section ends.' },
    { id: 'end-of-song', label: 'End of Song', desc: 'Queue target, jump smoothly when current song ends.' },
    { id: 'dynamic', label: 'Dynamic', desc: 'Queue section -> jump at section end; Queue song -> jump at song end.' },
    { id: 'manual', label: 'Manual', desc: 'Queue target, jump only when manual GO button is pressed or playback stops.' },
  ];

  onMount(() => {
    apiFetch('/api/ips')
      .then((res) => res.json())
      .then((data) => {
        const port = data.port || 8080;
        setServerPort(port);
        const ipList = data.ips && data.ips.length > 0 ? data.ips : ['localhost'];
        setIps(ipList);
        if (ipList.length > 0 && qrRef) {
          const token = getAuthToken();
          const mainUrl = `http://${ipList[0]}:${port}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
          const qrCode = new QRCodeStyling({
            width: 160,
            height: 160,
            type: 'svg',
            data: mainUrl,
            dotsOptions: {
              color: '#00e676',
              type: 'dots',
              gradient: {
                type: 'linear',
                rotation: 45,
                colorStops: [
                  { offset: 0, color: '#00e676' },
                  { offset: 1, color: '#00bcd4' },
                ],
              },
            },
            backgroundOptions: {
              color: 'transparent',
            },
            cornersSquareOptions: {
              color: '#00e676',
              type: 'extra-rounded',
            },
            cornersDotOptions: {
              color: '#00bcd4',
              type: 'dot',
            },
          });
          qrRef.innerHTML = '';
          qrCode.append(qrRef);
        }
      })
      .catch(() => {
        setIps(['localhost']);
      });
  });

  function getMidiActionLabel(action: MidiAction): string {
    switch (action.type) {
      case 'play': return 'Play';
      case 'pause': return 'Pause';
      case 'stop': return 'Stop';
      case 'go': return 'GO Button (Smart)';
      case 'next-song': return 'Next Song';
      case 'prev-song': return 'Previous Song';
      case 'next-section': return 'Next Section';
      case 'prev-section': return 'Previous Section';
      case 'toggle-loop': return 'Toggle Loop';
      case 'cancel-queue': return 'Cancel Queue';
      case 'jump-to-song': return `Jump to Song #${action.songIndex !== undefined ? action.songIndex + 1 : ''}`;
      case 'jump-to-section': return `Jump to Section #${action.sectionIndex !== undefined ? action.sectionIndex + 1 : ''}`;
      default: return 'Custom Action';
    }
  }

  const handleToggleWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        await navigator.wakeLock.request('screen');
        setWakeLockActive(true);
        showToast('Screen Wake Lock active!', 'success');
      } else {
        showToast('Wake Lock API not supported in this browser', 'error');
      }
    } catch {
      showToast('Could not acquire Screen Lock', 'error');
    }
  };

  return (
    <div class="view settings-view">
      <div class="view-header">
        <h2 class="view-title">Settings</h2>
      </div>

      <div class="settings-container">
        {/* Section 0: App Theme */}
        <div class="settings-card">
          <h3>App Theme & Color Palette</h3>
          <p class="settings-desc">Select a refined color theme optimized for your environment (studio, dark stage, or outdoor daylight).</p>
          <div class="theme-grid">
            <For each={themes}>
              {(theme) => (
                <div
                  class="theme-card"
                  role="button" tabIndex={0} aria-label={theme.name}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                  classList={{ 'is-selected': (store.settings.theme || 'midnight') === theme.id }}
                  data-theme-val={theme.id}
                  onClick={() => {
                    dispatch({ type: 'settings.set', key: 'theme', value: theme.id });
                    applyTheme(theme.id);
                    showToast(`Theme updated to ${theme.name}`, 'info');
                  }}
                >
                  <div class={`theme-preview theme-preview-${theme.id}`}>
                    <div class="preview-header"></div>
                    <div class="preview-body">
                      <span class="preview-chip preview-chip-accent"></span>
                      <span class="preview-chip"></span>
                    </div>
                  </div>
                  <div class="theme-info">
                    <strong>{theme.name}</strong>
                    <small>{theme.desc}</small>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Section 1: Playback & Jump Modes */}
        <div class="settings-card">
          <h3>Playback & Jump Modes</h3>
          <p class="settings-desc">Choose how setlist jumps are queued and quantized on stage.</p>
          <div class="radio-group" id="jump-mode-group">
            <For each={jumpModes}>
              {(mode) => (
                <label class="radio-option" classList={{ 'is-selected': store.settings.jumpMode === mode.id }}>
                  <input
                    type="radio"
                    name="jumpMode"
                    value={mode.id}
                    checked={store.settings.jumpMode === mode.id}
                    onChange={() => {
                      dispatch({ type: 'settings.set', key: 'jumpMode', value: mode.id });
                      showToast(`Jump Mode set to ${mode.label}`, 'info');
                    }}
                  />
                  <div>
                    <strong>{mode.label}</strong>
                    <small>{mode.desc}</small>
                  </div>
                </label>
              )}
            </For>
          </div>
        </div>

        {/* Section 2: MIDI Controller Mapping */}
        <div class="settings-card">
          <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
            <div>
              <h3>MIDI Controller Mapping</h3>
              <p class="settings-desc">Map hardware MIDI pedals or controllers using MIDI Learn.</p>
            </div>
            <button class="btn btn-primary" onClick={() => setShowAddMidiModal(true)}>Add Mapping</button>
          </div>

          <div class="midi-devices-info">
            <small style={{ color: 'var(--text-secondary)' }}>
              Active Inputs: <strong>{store.midi.inputs.length > 0 ? store.midi.inputs.join(', ') : 'None detected'}</strong>
            </small>
          </div>

          <div class="midi-mappings-list" style={{ display: 'flex', 'flex-direction': 'column', gap: '8px', 'margin-top': '10px' }}>
            <Show
              when={store.midi.mappings && store.midi.mappings.length > 0}
              fallback={
                <div style={{ color: 'var(--text-muted)', 'font-size': '0.9rem' }}>
                  No MIDI mappings configured. Click "Add Mapping" above to create one.
                </div>
              }
            >
              <For each={store.midi.mappings}>
                {(mapping) => {
                  const isLearningThis = () => store.midi.learning && store.midi.learningMappingId === mapping.id;
                  const actionText = () => getMidiActionLabel(mapping.action);
                  const noteDetail = () => mapping.note !== undefined ? `Note ${mapping.note}` : mapping.cc !== undefined ? `CC #${mapping.cc}` : '';
                  const midiDetails = () => mapping.messageType
                    ? `${mapping.messageType.toUpperCase()} | Ch:${mapping.channel}${noteDetail() ? ' | ' + noteDetail() : ''}`
                    : 'Not learned yet';

                  return (
                    <div
                      class="search-result-item"
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'space-between',
                        gap: '12px',
                        padding: '10px 14px',
                      }}
                    >
                      <div style={{ flex: '1', 'min-width': '0' }}>
                        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                          <strong style={{ 'font-size': '0.95rem' }}>{actionText()}</strong>
                          <Show when={isLearningThis()}>
                            <span class="badge" style={{ background: 'var(--warning)', color: '#000', 'font-weight': '700' }}>
                              LEARNING...
                            </span>
                          </Show>
                        </div>
                        <small style={{ color: 'var(--text-secondary)', 'font-family': 'monospace' }}>
                          {midiDetails()}
                        </small>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          class="btn btn-sm btn-secondary"
                          onClick={() => {
                            dispatch({ type: 'midi.learn', mappingId: mapping.id });
                            showToast(`Learning action: ${actionText()} — Trigger MIDI input now`, 'info');
                          }}
                        >
                          Learn
                        </button>
                        <button
                          class="btn btn-sm"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => {
                            dispatch({ type: 'midi.remove-mapping', mappingId: mapping.id });
                            showToast('Deleted MIDI mapping', 'info');
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>

        {/* Section 3: Display & Screen Wake */}
        <div class="settings-card">
          <h3>Display & Stage Preferences</h3>
          <p class="settings-desc">Configure screen behavior and view presets.</p>
          <div class="setting-row">
            <label for="default-view-select">Default View on App Start</label>
            <select
              id="default-view-select"
              class="select-input"
              value={store.settings.defaultView || 'setlist'}
              onChange={async (e) => {
                const value = e.currentTarget.value;
                try {
                  // Choosing a startup view also dismisses the first-run Help override.
                  await window.desktop?.finishSetup();
                  dispatch({ type: 'settings.set', key: 'defaultView', value });
                } catch {
                  showToast('Could not save the startup preference. Please try again.', 'error');
                }
              }}
            >
              <option value="setlist">Setlist View</option>
              <option value="performance">Stage / Performance View</option>
              <option value="sections">Sections Quick-Grid View</option>
            </select>
          </div>
          <div class="setting-row">
            <label for="toggle-24h">24-Hour Stage Clock</label>
            <input
              type="checkbox"
              id="toggle-24h"
              checked={store.settings.show24HourClock}
              onChange={(e) => {
                dispatch({ type: 'settings.set', key: 'show24HourClock', value: e.currentTarget.checked });
              }}
            />
          </div>
          <div class="setting-row">
            <label for="toggle-wakelock">Keep Screen Awake (Wake Lock)</label>
            <button
              class="btn btn-sm btn-primary"
              id="btn-toggle-wake"
              disabled={wakeLockActive()}
              onClick={handleToggleWakeLock}
            >
              {wakeLockActive() ? 'Screen Lock Active' : 'Enable Screen Lock'}
            </button>
          </div>
        </div>

        <div class="settings-card"><h3>Setup & support</h3><p>Install AbletonJS, read help, check updates, or export diagnostics.</p><button class="btn" onClick={() => setView('help')}>Open setup & help</button></div>
        {/* Section 4: Mobile Device Connection */}
        <div class="settings-card">
          <h3>Mobile Device Connection</h3>
          <p class="settings-desc">Connect phones or tablets on stage using your local Wi-Fi network.</p>
          <div class="setting-row">
            <label for="toggle-lan-mode">Local network access</label>
            <input
              type="checkbox"
              role="switch"
              id="toggle-lan-mode"
              aria-describedby="lan-mode-description"
              checked={store.settings.lanMode ?? false}
              disabled={store.connection !== 'connected'}
              onChange={(e) => {
                dispatch({ type: 'settings.set', key: 'lanMode', value: e.currentTarget.checked });
              }}
            />
          </div>
          <p id="lan-mode-description" class="settings-desc">
            Allow phones and tablets on the same Wi-Fi network to connect using the QR code.
            Restart Alive Set Manager after changing this setting to apply it.
          </p>
          <div style={{ display: 'flex', 'flex-wrap': 'wrap', 'justify-content': 'space-between', 'align-items': 'center', gap: '20px', 'margin-top': '10px' }}>
            <div class="connection-info" style={{ display: 'flex', 'flex-direction': 'column', gap: '10px', flex: '1', 'min-width': '240px' }}>
              <div>
                WebSocket Status: <span class={`status-badge status-${store.connection}`}>{store.connection.toUpperCase()}</span>
              </div>
              <div>
                Local Address: <strong>{`http://${window.location.host || 'localhost:8080'}`}</strong>
              </div>
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-secondary)', 'font-size': '0.85rem' }}>Mobile Wi-Fi Addresses:</span>
                <For each={ips()}>
                  {(ip) => (
                    <div style={{ 'font-size': '1.05rem', 'font-weight': '700', color: 'var(--accent)', 'font-family': 'monospace' }}>
                      {`http://${ip}:${serverPort()}`}
                    </div>
                  )}
                </For>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                'flex-direction': 'column',
                'align-items': 'center',
                background: 'rgba(255,255,255,0.03)',
                padding: '16px',
                'border-radius': 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                'min-width': '180px',
              }}
            >
              <div ref={qrRef} style={{ width: '160px', height: '160px', display: 'flex', 'align-items': 'center', 'justify-content': 'center' }}></div>
              <small style={{ color: 'var(--text-secondary)', 'margin-top': '8px', 'font-weight': '600' }}>Scan to Connect</small>
            </div>
          </div>
        </div>
      </div>

      {/* Add MIDI Mapping Modal */}
      <Show when={showAddMidiModal()}>
        <div class="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowAddMidiModal(false); }}>
          <div class="modal-content">
            <div class="modal-header">
              <h3>Add MIDI Mapping</h3>
              <button class="btn-icon modal-close" onClick={() => setShowAddMidiModal(false)}>✕</button>
            </div>
            <div class="modal-body" style={{ display: 'flex', 'flex-direction': 'column', gap: '14px' }}>
              <div class="setting-row">
                <label>Action to Trigger</label>
                <select
                  class="select-input"
                  value={midiActionType()}
                  onChange={(e) => setMidiActionType(e.currentTarget.value)}
                >
                  <option value="go">GO Button (Smart)</option>
                  <option value="play">Play</option>
                  <option value="pause">Pause</option>
                  <option value="stop">Stop</option>
                  <option value="next-song">Next Song</option>
                  <option value="prev-song">Previous Song</option>
                  <option value="toggle-loop">Toggle Loop</option>
                  <option value="cancel-queue">Cancel Queue</option>
                </select>
              </div>

              <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '10px', 'margin-top': '10px' }}>
                <button class="btn btn-secondary" onClick={() => setShowAddMidiModal(false)}>Cancel</button>
                <button
                  class="btn btn-primary"
                  onClick={() => {
                    const type = midiActionType() as any;
                    const mappingId = `midi-${Date.now()}`;
                    const newMapping: MidiMapping = {
                      id: mappingId,
                      inputName: '',
                      messageType: 'note-on',
                      channel: 1,
                      action: { type },
                    };
                    dispatch({ type: 'midi.add-mapping', mapping: newMapping });
                    dispatch({ type: 'midi.learn', mappingId });
                    showToast('Press any button/pedal on your MIDI controller now...', 'info');
                    setShowAddMidiModal(false);
                  }}
                >
                  Add & Learn
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
