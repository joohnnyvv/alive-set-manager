import { Store } from '../state/store.js';
import { JumpMode, MidiAction, MidiMapping } from '../types.js';
import { showToast } from '../components/Toast.js';
import { apiFetch } from '../api/http.js';
import QRCodeStylingPkg from 'qr-code-styling';
const QRCodeStyling: any = (QRCodeStylingPkg as any).default || QRCodeStylingPkg;

export function renderSettingsView(store: Store): HTMLElement {
  const view = document.createElement('div');
  view.className = 'view settings-view';

  const state = store.getState();
  const settings = state.settings;

  // Header
  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = '<h2 class="view-title">Settings</h2>';
  view.appendChild(header);

  const container = document.createElement('div');
  container.className = 'settings-container';

  // Section 0: App Theme & Color Palette
  const currentTheme = settings.theme || 'midnight';
  const themeSection = document.createElement('div');
  themeSection.className = 'settings-card';
  themeSection.innerHTML = `
    <h3>App Theme & Color Palette</h3>
    <p class="settings-desc">Select a refined color theme optimized for your environment (studio, dark stage, or outdoor daylight).</p>
    <div class="theme-grid">
      <div class="theme-card ${currentTheme === 'midnight' ? 'is-selected' : ''}" data-theme-val="midnight">
        <div class="theme-preview theme-preview-midnight">
          <div class="preview-header"></div>
          <div class="preview-body">
            <span class="preview-chip preview-chip-accent"></span>
            <span class="preview-chip"></span>
          </div>
        </div>
        <div class="theme-info">
          <strong>Midnight Studio</strong>
          <small>Toned dark mode with slate tones & emerald accents.</small>
        </div>
      </div>

      <div class="theme-card ${currentTheme === 'live-dark' ? 'is-selected' : ''}" data-theme-val="live-dark">
        <div class="theme-preview theme-preview-live-dark">
          <div class="preview-header"></div>
          <div class="preview-body">
            <span class="preview-chip preview-chip-accent"></span>
            <span class="preview-chip"></span>
          </div>
        </div>
        <div class="theme-info">
          <strong>Ableton Live Dark</strong>
          <small>Classic Ableton Live 11/12 dark gray style with warm amber accents.</small>
        </div>
      </div>

      <div class="theme-card ${currentTheme === 'live-light' ? 'is-selected' : ''}" data-theme-val="live-light">
        <div class="theme-preview theme-preview-live-light">
          <div class="preview-header"></div>
          <div class="preview-body">
            <span class="preview-chip preview-chip-accent"></span>
            <span class="preview-chip"></span>
          </div>
        </div>
        <div class="theme-info">
          <strong>Ableton Live Light</strong>
          <small>Light gray theme for bright daylight or outdoor festival stages.</small>
        </div>
      </div>

      <div class="theme-card ${currentTheme === 'high-contrast' ? 'is-selected' : ''}" data-theme-val="high-contrast">
        <div class="theme-preview theme-preview-high-contrast">
          <div class="preview-header"></div>
          <div class="preview-body">
            <span class="preview-chip preview-chip-accent"></span>
            <span class="preview-chip"></span>
          </div>
        </div>
        <div class="theme-info">
          <strong>High Contrast Stage</strong>
          <small>Pitch black background with neon lime accents & bold borders.</small>
        </div>
      </div>

      <div class="theme-card ${currentTheme === 'soft-dark' ? 'is-selected' : ''}" data-theme-val="soft-dark">
        <div class="theme-preview theme-preview-soft-dark">
          <div class="preview-header"></div>
          <div class="preview-body">
            <span class="preview-chip preview-chip-accent"></span>
            <span class="preview-chip"></span>
          </div>
        </div>
        <div class="theme-info">
          <strong>Soft Dark</strong>
          <small>Low-contrast dark theme with muted tones and zero sharp flare.</small>
        </div>
      </div>
    </div>
  `;

  themeSection.querySelectorAll('.theme-card').forEach((card) => {
    card.addEventListener('click', () => {
      const selectedTheme = card.getAttribute('data-theme-val');
      if (selectedTheme) {
        store.dispatch({ type: 'settings.set', key: 'theme', value: selectedTheme });
        themeSection.querySelectorAll('.theme-card').forEach(c => c.classList.remove('is-selected'));
        card.classList.add('is-selected');
        showToast(`Theme updated to ${selectedTheme.replace('-', ' ')}`, 'info');
      }
    });
  });

  container.appendChild(themeSection);

  // Section 1: Jump Mode
  const jumpSection = document.createElement('div');
  jumpSection.className = 'settings-card';
  jumpSection.innerHTML = `
    <h3>Playback & Jump Modes</h3>
    <p class="settings-desc">Choose how setlist jumps are queued and quantized on stage.</p>
    <div class="radio-group" id="jump-mode-group">
      <label class="radio-option ${settings.jumpMode === 'quantized' ? 'is-selected' : ''}">
        <input type="radio" name="jumpMode" value="quantized" ${settings.jumpMode === 'quantized' ? 'checked' : ''} />
        <div>
          <strong>Quantized</strong>
          <small>Jump immediately, letting Ableton quantize naturally.</small>
        </div>
      </label>
      <label class="radio-option ${settings.jumpMode === 'end-of-section' ? 'is-selected' : ''}">
        <input type="radio" name="jumpMode" value="end-of-section" ${settings.jumpMode === 'end-of-section' ? 'checked' : ''} />
        <div>
          <strong>End of Section</strong>
          <small>Queue target, jump smoothly when current section ends.</small>
        </div>
      </label>
      <label class="radio-option ${settings.jumpMode === 'end-of-song' ? 'is-selected' : ''}">
        <input type="radio" name="jumpMode" value="end-of-song" ${settings.jumpMode === 'end-of-song' ? 'checked' : ''} />
        <div>
          <strong>End of Song</strong>
          <small>Queue target, jump smoothly when current song ends.</small>
        </div>
      </label>
      <label class="radio-option ${settings.jumpMode === 'dynamic' ? 'is-selected' : ''}">
        <input type="radio" name="jumpMode" value="dynamic" ${settings.jumpMode === 'dynamic' ? 'checked' : ''} />
        <div>
          <strong>Dynamic</strong>
          <small>Queue section -> jump at section end; Queue song -> jump at song end.</small>
        </div>
      </label>
      <label class="radio-option ${settings.jumpMode === 'manual' ? 'is-selected' : ''}">
        <input type="radio" name="jumpMode" value="manual" ${settings.jumpMode === 'manual' ? 'checked' : ''} />
        <div>
          <strong>Manual</strong>
          <small>Queue target, jump only when manual GO button is pressed or playback stops.</small>
        </div>
      </label>
    </div>
  `;

  jumpSection.querySelectorAll('input[name="jumpMode"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const mode = (e.target as HTMLInputElement).value as JumpMode;
      store.dispatch({ type: 'settings.set', key: 'jumpMode', value: mode });
      showToast(`Jump Mode set to ${mode}`, 'info');
    });
  });

  container.appendChild(jumpSection);

  // Section 2: MIDI Controller Mapping
  const midiSection = document.createElement('div');
  midiSection.className = 'settings-card';

  const midiHeader = document.createElement('div');
  midiHeader.style.display = 'flex';
  midiHeader.style.justifyContent = 'space-between';
  midiHeader.style.alignItems = 'center';
  midiHeader.innerHTML = `
    <div>
      <h3>MIDI Controller Mapping</h3>
      <p class="settings-desc">Map hardware MIDI pedals or controllers using MIDI Learn.</p>
    </div>
    <button class="btn btn-primary" id="btn-add-midi">Add Mapping</button>
  `;
  midiSection.appendChild(midiHeader);

  const midiDevicesBox = document.createElement('div');
  midiDevicesBox.className = 'midi-devices-info';
  const inputsList = state.midi.inputs.length > 0 ? state.midi.inputs.join(', ') : 'None detected';
  
  const devSmall = document.createElement('small');
  devSmall.style.color = 'var(--text-secondary)';
  devSmall.appendChild(document.createTextNode('Active Inputs: '));
  const devStrong = document.createElement('strong');
  devStrong.textContent = inputsList;
  devSmall.appendChild(devStrong);
  midiDevicesBox.appendChild(devSmall);
  midiSection.appendChild(midiDevicesBox);

  const mappingsList = document.createElement('div');
  mappingsList.className = 'midi-mappings-list';
  mappingsList.style.display = 'flex';
  mappingsList.style.flexDirection = 'column';
  mappingsList.style.gap = '8px';
  mappingsList.style.marginTop = '10px';

  if (!state.midi.mappings || state.midi.mappings.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.color = 'var(--text-muted)';
    emptyMsg.style.fontSize = '0.9rem';
    emptyMsg.textContent = 'No MIDI mappings configured. Click "Add Mapping" above to create one.';
    mappingsList.appendChild(emptyMsg);
  } else {
    state.midi.mappings.forEach((mapping) => {
      const row = document.createElement('div');
      row.className = 'search-result-item';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '12px';
      row.style.padding = '10px 14px';

      const isLearningThis = state.midi.learning && state.midi.learningMappingId === mapping.id;
      const actionText = getMidiActionLabel(mapping.action);

      const noteDetail = mapping.note !== undefined ? `Note ${mapping.note}` : mapping.cc !== undefined ? `CC #${mapping.cc}` : '';
      const midiDetails = mapping.messageType
        ? `${mapping.messageType.toUpperCase()} | Ch:${mapping.channel}${noteDetail ? ' | ' + noteDetail : ''}`
        : 'Not learned yet';

      const infoBox = document.createElement('div');
      infoBox.style.flex = '1';
      infoBox.style.minWidth = '0';

      const titleRow = document.createElement('div');
      titleRow.style.display = 'flex';
      titleRow.style.alignItems = 'center';
      titleRow.style.gap = '8px';
      titleRow.style.marginBottom = '4px';

      const titleStrong = document.createElement('strong');
      titleStrong.style.color = 'var(--text-primary)';
      titleStrong.style.fontSize = '0.95rem';
      titleStrong.textContent = actionText;
      titleRow.appendChild(titleStrong);
      infoBox.appendChild(titleRow);

      const detailsRow = document.createElement('div');
      detailsRow.style.fontSize = '0.8rem';
      detailsRow.style.color = 'var(--text-secondary)';
      detailsRow.style.display = 'flex';
      detailsRow.style.alignItems = 'center';
      detailsRow.style.gap = '8px';
      detailsRow.style.flexWrap = 'wrap';

      const deviceSelect = document.createElement('select');
      deviceSelect.className = 'select-input select-midi-device';
      deviceSelect.style.padding = '2px 6px';
      deviceSelect.style.fontSize = '0.75rem';
      deviceSelect.style.borderRadius = '4px';
      deviceSelect.style.maxWidth = '200px';

      // Option Any Device
      const anyOpt = document.createElement('option');
      anyOpt.value = 'Any Device';
      anyOpt.textContent = '🌐 Any Device';
      if (!mapping.inputName || mapping.inputName === 'Any Device') anyOpt.selected = true;
      deviceSelect.appendChild(anyOpt);

      const activeInputs = state.midi.inputs || [];
      activeInputs.forEach(dev => {
        const opt = document.createElement('option');
        opt.value = dev;
        opt.textContent = `🔒 ${dev}`;
        if (mapping.inputName === dev) opt.selected = true;
        deviceSelect.appendChild(opt);
      });

      if (mapping.inputName && mapping.inputName !== 'Any Device' && !activeInputs.includes(mapping.inputName)) {
        const offlineOpt = document.createElement('option');
        offlineOpt.value = mapping.inputName;
        offlineOpt.textContent = `⚠️ ${mapping.inputName} (Offline)`;
        offlineOpt.selected = true;
        deviceSelect.appendChild(offlineOpt);
      }

      deviceSelect.onchange = () => {
        const updatedDev = deviceSelect.value;
        store.dispatch({
          type: 'midi.update-mapping',
          mapping: { ...mapping, inputName: updatedDev },
        });
        showToast(`Locked "${actionText}" to ${updatedDev === 'Any Device' ? 'Any Device' : updatedDev}`, 'success');
      };

      const detailBadge = document.createElement('span');
      detailBadge.style.background = 'var(--bg-tertiary, #2a2a2a)';
      detailBadge.style.padding = '2px 6px';
      detailBadge.style.borderRadius = '4px';
      detailBadge.style.fontFamily = 'monospace';
      detailBadge.style.fontSize = '0.75rem';
      detailBadge.textContent = midiDetails;

      detailsRow.appendChild(deviceSelect);
      detailsRow.appendChild(detailBadge);
      infoBox.appendChild(detailsRow);

      const btnGroup = document.createElement('div');
      btnGroup.style.display = 'flex';
      btnGroup.style.gap = '8px';
      btnGroup.style.alignItems = 'center';

      const learnBtn = document.createElement('button');
      learnBtn.className = `btn btn-sm ${isLearningThis ? 'btn-primary pulse-anim' : 'btn-secondary'} btn-learn-midi`;
      learnBtn.textContent = isLearningThis ? '⏳ Listening...' : 'Learn';
      learnBtn.onclick = () => {
        store.dispatch({ type: 'midi.learn', mappingId: mapping.id });
        showToast(`Press any button/pedal for "${actionText}"...`, 'info');
      };

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon btn-remove btn-del-midi';
      delBtn.title = 'Remove Mapping';
      delBtn.textContent = '✕';
      delBtn.onclick = () => {
        store.dispatch({ type: 'midi.remove-mapping', mappingId: mapping.id });
        showToast('Removed MIDI mapping', 'info');
      };

      btnGroup.appendChild(learnBtn);
      btnGroup.appendChild(delBtn);

      row.appendChild(infoBox);
      row.appendChild(btnGroup);
      mappingsList.appendChild(row);
    });
  }

  midiSection.appendChild(mappingsList);

  midiHeader.querySelector('#btn-add-midi')!.addEventListener('click', () => {
    openAddMidiModal(store);
  });

  container.appendChild(midiSection);

  // Section 3: Display & Screen Lock
  const displaySection = document.createElement('div');
  displaySection.className = 'settings-card';
  displaySection.innerHTML = `
    <h3>Display & Screen Wake</h3>
    <div class="setting-row">
      <label for="default-view-select">Default View</label>
      <select id="default-view-select" class="select-input">
        <option value="setlist" ${settings.defaultView === 'setlist' ? 'selected' : ''}>Setlist</option>
        <option value="performance" ${settings.defaultView === 'performance' ? 'selected' : ''}>Performance</option>
        <option value="sections" ${settings.defaultView === 'sections' ? 'selected' : ''}>Sections</option>
      </select>
    </div>
    <div class="setting-row">
      <label for="toggle-24h">24-Hour Clock</label>
      <input type="checkbox" id="toggle-24h" ${settings.show24HourClock ? 'checked' : ''} />
    </div>
    <div class="setting-row">
      <label for="toggle-wakelock">Keep Screen Awake (Wake Lock)</label>
      <button class="btn btn-sm btn-primary" id="btn-toggle-wake">Enable Screen Lock</button>
    </div>
  `;

  const viewSelect = displaySection.querySelector('#default-view-select') as HTMLSelectElement;
  viewSelect.onchange = () => {
    store.dispatch({ type: 'settings.set', key: 'defaultView', value: viewSelect.value });
  };

  const toggle24h = displaySection.querySelector('#toggle-24h') as HTMLInputElement;
  toggle24h.onchange = () => {
    store.dispatch({ type: 'settings.set', key: 'show24HourClock', value: toggle24h.checked });
  };

  const wakeBtn = displaySection.querySelector('#btn-toggle-wake') as HTMLButtonElement;
  wakeBtn.onclick = async () => {
    try {
      if ('wakeLock' in navigator) {
        await navigator.wakeLock.request('screen');
        showToast('Screen Wake Lock active!', 'success');
        wakeBtn.textContent = 'Screen Lock Active';
        wakeBtn.disabled = true;
      } else {
        showToast('Wake Lock API not supported in this browser', 'error');
      }
    } catch (err) {
      showToast('Could not acquire Screen Lock', 'error');
    }
  };

  container.appendChild(displaySection);

  // Section 4: Connection Info
  const connSection = document.createElement('div');
  connSection.className = 'settings-card';
  const currentHost = window.location.host || 'localhost:8080';

  connSection.innerHTML = `
    <h3>Mobile Device Connection</h3>
    <p class="settings-desc">Connect phones or tablets on stage using your local Wi-Fi network.</p>
    <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:20px; margin-top:10px;">
      <div class="connection-info" style="display:flex; flex-direction:column; gap:10px; flex:1; min-width:240px;">
        <div>WebSocket Status: <span class="status-badge status-${state.connection}">${state.connection.toUpperCase()}</span></div>
        <div>Local Address: <strong>http://${currentHost}</strong></div>
        <div id="mobile-ips-container" style="display:flex; flex-direction:column; gap:4px;">
          <span style="color:var(--text-secondary); font-size:0.85rem;">Mobile Wi-Fi Addresses:</span>
          <strong style="color:var(--accent);">Loading Wi-Fi URLs...</strong>
        </div>
      </div>
      <div id="qr-code-box" style="display:flex; flex-direction:column; align-items:center; background:rgba(255,255,255,0.03); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-color); min-width:180px;">
        <div id="qr-code-canvas" style="width:160px; height:160px; display:flex; align-items:center; justify-content:center;"></div>
        <small style="color:var(--text-secondary); margin-top:8px; font-weight:600;">Scan to Connect</small>
      </div>
    </div>
  `;

  apiFetch('/api/ips')
    .then(r => r.json())
    .then(data => {
      const containerEl = connSection.querySelector('#mobile-ips-container');
      const qrCanvasEl = connSection.querySelector('#qr-code-canvas') as HTMLElement;

      const port = data.port || 8080;
      const ips = data.ips && data.ips.length > 0 ? data.ips : ['localhost'];
      const mainUrl = `http://${ips[0]}:${port}`;

      if (containerEl) {
        containerEl.innerHTML = '';
        const titleSpan = document.createElement('span');
        titleSpan.style.color = 'var(--text-secondary)';
        titleSpan.style.fontSize = '0.85rem';
        titleSpan.textContent = 'Mobile Wi-Fi Addresses:';
        containerEl.appendChild(titleSpan);

        ips.forEach((ip: string) => {
          const urlDiv = document.createElement('div');
          urlDiv.style.fontSize = '1.05rem';
          urlDiv.style.fontWeight = '700';
          urlDiv.style.color = 'var(--accent)';
          urlDiv.style.fontFamily = 'monospace';
          urlDiv.textContent = `http://${ip}:${port}`;
          containerEl.appendChild(urlDiv);
        });
      }

      if (qrCanvasEl) {
        qrCanvasEl.innerHTML = '';
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
        qrCode.append(qrCanvasEl);
      }
    })
    .catch(() => {
      const containerEl = connSection.querySelector('#mobile-ips-container');
      if (containerEl) {
        containerEl.innerHTML = `<div>Mobile URL: <strong>http://localhost:8080</strong></div>`;
      }
    });

  container.appendChild(connSection);

  view.appendChild(container);

  return view;
}

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
    case 'jump-to-song': return `Jump to Song #${action.songIndex + 1}`;
    case 'jump-to-section': return `Jump to Section #${action.sectionIndex + 1}`;
    default: return 'Custom Action';
  }
}

function openAddMidiModal(store: Store): void {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';

  const content = document.createElement('div');
  content.className = 'modal-content';

  content.innerHTML = `
    <div class="modal-header">
      <h3>Add MIDI Mapping</h3>
      <button class="btn-icon modal-close">✕</button>
    </div>
    <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
      <div class="setting-row">
        <label>Action to Trigger</label>
        <select id="midi-action-select" class="select-input">
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

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
        <button class="btn btn-secondary cancel-btn">Cancel</button>
        <button class="btn btn-primary add-btn">Add & Learn</button>
      </div>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  const closeBtn = content.querySelector('.modal-close') as HTMLElement;
  const cancelBtn = content.querySelector('.cancel-btn') as HTMLElement;
  const addBtn = content.querySelector('.add-btn') as HTMLElement;
  const select = content.querySelector('#midi-action-select') as HTMLSelectElement;

  const closeModal = () => modal.remove();
  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;

  addBtn.onclick = () => {
    const type = select.value as any;
    const mappingId = `midi-${Date.now()}`;

    const newMapping: MidiMapping = {
      id: mappingId,
      inputName: '',
      messageType: 'note-on',
      channel: 1,
      action: { type },
    };

    store.dispatch({ type: 'midi.add-mapping', mapping: newMapping });
    store.dispatch({ type: 'midi.learn', mappingId });

    showToast('Press any button/pedal on your MIDI controller now...', 'info');
    closeModal();
  };
}
