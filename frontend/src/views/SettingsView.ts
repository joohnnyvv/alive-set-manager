import { Store } from '../state/store.js';
import { JumpMode, MidiAction, MidiMapping } from '../types.js';
import { showToast } from '../components/Toast.js';

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
    <button class="btn btn-primary" id="btn-add-midi">＋ Add Mapping</button>
  `;
  midiSection.appendChild(midiHeader);

  const midiDevicesBox = document.createElement('div');
  midiDevicesBox.className = 'midi-devices-info';
  const inputsList = state.midi.inputs.length > 0 ? state.midi.inputs.join(', ') : 'None detected';
  midiDevicesBox.innerHTML = `<small style="color:var(--text-secondary);">Active Inputs: <strong>${inputsList}</strong></small>`;
  midiSection.appendChild(midiDevicesBox);

  const mappingsList = document.createElement('div');
  mappingsList.className = 'midi-mappings-list';
  mappingsList.style.display = 'flex';
  mappingsList.style.flexDirection = 'column';
  mappingsList.style.gap = '8px';
  mappingsList.style.marginTop = '10px';

  if (!state.midi.mappings || state.midi.mappings.length === 0) {
    mappingsList.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem;">No MIDI mappings configured.</div>';
  } else {
    state.midi.mappings.forEach((mapping) => {
      const row = document.createElement('div');
      row.className = 'search-result-item';
      const isLearningThis = state.midi.learning && state.midi.learningMappingId === mapping.id;

      const actionText = getMidiActionLabel(mapping.action);
      const msgInfo = mapping.inputName ? `${mapping.inputName} (${mapping.messageType} Ch:${mapping.channel})` : 'Unassigned (click Learn)';

      row.innerHTML = `
        <div>
          <strong>${actionText}</strong>
          <div style="font-size:0.8rem; color:var(--text-secondary);">${msgInfo}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm ${isLearningThis ? 'btn-primary' : 'btn-secondary'} btn-learn-midi">
            ${isLearningThis ? '⏳ Listening...' : 'Learn'}
          </button>
          <button class="btn-icon btn-remove btn-del-midi">✕</button>
        </div>
      `;

      row.querySelector('.btn-learn-midi')!.addEventListener('click', () => {
        store.dispatch({ type: 'midi.learn', mappingId: mapping.id });
        showToast('Press any button/pedal on your MIDI controller...', 'info');
      });

      row.querySelector('.btn-del-midi')!.addEventListener('click', () => {
        store.dispatch({ type: 'midi.remove-mapping', mappingId: mapping.id });
        showToast('Removed MIDI mapping', 'info');
      });

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
        wakeBtn.textContent = 'Screen Lock Active ✓';
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
  connSection.innerHTML = `
    <h3>Mobile Device Connection</h3>
    <p class="settings-desc">Connect phones or tablets on stage using your local Wi-Fi network.</p>
    <div class="connection-info">
      <div>Server Address: <strong>http://${window.location.host}</strong></div>
      <div>WebSocket Status: <span class="status-badge status-${state.connection}">${state.connection.toUpperCase()}</span></div>
    </div>
  `;
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
