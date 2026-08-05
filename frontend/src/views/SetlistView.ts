import { Store } from '../state/store.js';
import { renderSongItem } from '../components/SongItem.js';
import { Song, Section, StopBehavior } from '../types.js';
import { formatDuration } from '../utils/formatTime.js';
import { showToast } from '../components/Toast.js';

export function renderSetlistView(store: Store): HTMLElement {
  const view = document.createElement('div');
  view.className = 'view setlist-view';

  const state = store.getState();
  const setlist = state.setlist;

  // Header
  const header = document.createElement('div');
  header.className = 'view-header';

  const title = document.createElement('h2');
  title.className = 'view-title';
  title.textContent = 'Setlist';

  const headerActions = document.createElement('div');
  headerActions.className = 'header-actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.innerHTML = '＋ Add Song';
  addBtn.onclick = () => openAddSongModal(store);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-secondary';
  saveBtn.innerHTML = '💾 Save';
  saveBtn.onclick = () => promptSaveSetlist(store);

  const loadBtn = document.createElement('button');
  loadBtn.className = 'btn btn-secondary';
  loadBtn.innerHTML = '📂 Load';
  loadBtn.onclick = () => promptLoadSetlist(store);

  const copyTextBtn = document.createElement('button');
  copyTextBtn.className = 'btn btn-secondary';
  copyTextBtn.innerHTML = '📋 Copy Text';
  copyTextBtn.onclick = () => copySetlistAsText(store);

  const importTextBtn = document.createElement('button');
  importTextBtn.className = 'btn btn-secondary';
  importTextBtn.innerHTML = '📥 Import Text';
  importTextBtn.onclick = () => openImportTextModal(store);

  headerActions.appendChild(addBtn);
  headerActions.appendChild(saveBtn);
  headerActions.appendChild(loadBtn);
  headerActions.appendChild(copyTextBtn);
  headerActions.appendChild(importTextBtn);

  header.appendChild(title);
  header.appendChild(headerActions);
  view.appendChild(header);

  // Songs list container
  const listContainer = document.createElement('div');
  listContainer.className = 'setlist-container';

  if (!setlist.songs || setlist.songs.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <div class="empty-icon">🎵</div>
      <h3>No Songs Available</h3>
      <p>Connect Ableton Live with Cue Point locators or add songs manually.</p>
    `;
    listContainer.appendChild(emptyState);
  } else {
    setlist.songs.forEach((song, idx) => {
      const isActive = setlist.activeSongId === song.id;
      const isQueued = setlist.queuedSongId === song.id;

      const item = renderSongItem(
        song,
        idx,
        isActive,
        isQueued,
        setlist.activeSectionId,
        setlist.queuedSectionId,
        (s) => store.dispatch({ type: 'jump-to-song', songId: s.id }),
        (s) => store.dispatch({ type: 'setlist.remove-song', songId: s.id }),
        (s) => store.dispatch({ type: 'setlist.restore-song', songId: s.id }),
        (sec) => store.dispatch({ type: 'jump-to-section', sectionId: sec.id }),
        (s) => openEditSongModal(store, s)
      );

      // Setup Drag and Drop
      item.draggable = true;
      item.ondragstart = (e) => {
        e.dataTransfer?.setData('text/plain', song.id);
        item.classList.add('is-dragging');
      };
      item.ondragend = () => {
        item.classList.remove('is-dragging');
      };
      item.ondragover = (e) => {
        e.preventDefault();
        item.classList.add('drag-over');
      };
      item.ondragleave = () => {
        item.classList.remove('drag-over');
      };
      item.ondrop = (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        const draggedId = e.dataTransfer?.getData('text/plain');
        if (draggedId && draggedId !== song.id) {
          const currentOrder = [...setlist.order];
          const fromIdx = currentOrder.indexOf(draggedId);
          const toIdx = currentOrder.indexOf(song.id);
          if (fromIdx !== -1 && toIdx !== -1) {
            currentOrder.splice(fromIdx, 1);
            currentOrder.splice(toIdx, 0, draggedId);
            store.dispatch({ type: 'setlist.reorder', order: currentOrder });
          }
        }
      };

      listContainer.appendChild(item);
    });
  }

  view.appendChild(listContainer);

  // Footer bar: Total duration
  const footer = document.createElement('div');
  footer.className = 'setlist-footer';
  footer.innerHTML = `
    <span>Total Set Duration: <strong>${formatDuration(setlist.totalDuration)}</strong></span>
    <span>Remaining: <strong>${formatDuration(setlist.remainingTime)}</strong></span>
  `;
  view.appendChild(footer);

  return view;
}

function openAddSongModal(store: Store): void {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';

  const content = document.createElement('div');
  content.className = 'modal-content';

  content.innerHTML = `
    <div class="modal-header">
      <h3>Add Song to Setlist</h3>
      <button class="btn-icon modal-close">✕</button>
    </div>
    <div class="modal-body">
      <input type="text" class="input-search" id="song-search-input" placeholder="Search songs by name or tag (#rock)..." autofocus />
      <div class="search-results-list" id="search-results"></div>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  const closeBtn = content.querySelector('.modal-close') as HTMLElement;
  closeBtn.onclick = () => modal.remove();
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  const input = content.querySelector('#song-search-input') as HTMLInputElement;
  const resultsContainer = content.querySelector('#search-results') as HTMLElement;

  const allSongs = store.getState().setlist.songs;

  const renderResults = (query: string) => {
    resultsContainer.innerHTML = '';
    const q = query.toLowerCase().trim();
    const filtered = allSongs.filter(s => {
      if (!q) return true;
      if (q.startsWith('#')) {
        const tag = q.substring(1);
        return s.tags.some(t => t.toLowerCase().includes(tag));
      }
      return s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      resultsContainer.innerHTML = '<div class="empty-search">No matching songs found</div>';
      return;
    }

    filtered.forEach(s => {
      const row = document.createElement('div');
      row.className = 'search-result-item';
      row.innerHTML = `
        <div>
          <strong>${s.name}</strong> ${s.description ? `<small>{${s.description}}</small>` : ''}
        </div>
        <button class="btn btn-sm btn-primary">Add</button>
      `;
      row.querySelector('button')!.onclick = () => {
        if (s.isSkipped) {
          store.dispatch({ type: 'setlist.restore-song', songId: s.id });
        }
        showToast(`Added ${s.name} to active setlist`, 'success');
        modal.remove();
      };
      resultsContainer.appendChild(row);
    });
  };

  input.oninput = () => renderResults(input.value);
  renderResults('');
}

function openEditSongModal(store: Store, song: Song): void {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';

  const content = document.createElement('div');
  content.className = 'modal-content';

  content.innerHTML = `
    <div class="modal-header">
      <h3>Edit Song: ${song.name}</h3>
      <button class="btn-icon modal-close">✕</button>
    </div>
    <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
      <div class="setting-row">
        <label>Song Color</label>
        <select id="edit-color" class="select-input">
          <option value="" ${!song.color ? 'selected' : ''}>Default</option>
          <option value="red" ${song.color === 'red' ? 'selected' : ''}>Red</option>
          <option value="orange" ${song.color === 'orange' ? 'selected' : ''}>Orange</option>
          <option value="yellow" ${song.color === 'yellow' ? 'selected' : ''}>Yellow</option>
          <option value="green" ${song.color === 'green' ? 'selected' : ''}>Green</option>
          <option value="blue" ${song.color === 'blue' ? 'selected' : ''}>Blue</option>
          <option value="purple" ${song.color === 'purple' ? 'selected' : ''}>Purple</option>
        </select>
      </div>

      <div class="setting-row">
        <label>Stop Behavior at Song End</label>
        <select id="edit-stop-behavior" class="select-input">
          <option value="default" ${song.stopBehavior === 'default' ? 'selected' : ''}>Default (Auto-jump)</option>
          <option value="stop" ${song.stopBehavior === 'stop' ? 'selected' : ''}>Stop Playback</option>
          <option value="pause" ${song.stopBehavior === 'pause' ? 'selected' : ''}>Pause Playback</option>
        </select>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
        <button class="btn btn-secondary cancel-btn">Cancel</button>
        <button class="btn btn-primary save-btn">Save Changes</button>
      </div>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  const closeBtn = content.querySelector('.modal-close') as HTMLElement;
  const cancelBtn = content.querySelector('.cancel-btn') as HTMLElement;
  const saveBtn = content.querySelector('.save-btn') as HTMLElement;

  const closeModal = () => modal.remove();
  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;

  saveBtn.onclick = () => {
    const color = (content.querySelector('#edit-color') as HTMLSelectElement).value || undefined;
    const stopBehavior = (content.querySelector('#edit-stop-behavior') as HTMLSelectElement).value as StopBehavior;

    store.dispatch({
      type: 'setlist.update-song',
      songId: song.id,
      overrides: { color, stopBehavior },
    });

    showToast(`Updated options for ${song.name}`, 'success');
    closeModal();
  };
}

function copySetlistAsText(store: Store): void {
  const setlist = store.getState().setlist;
  const songNames = setlist.songs.filter(s => !s.isSkipped).map(s => s.name);
  const text = songNames.join('\n');

  navigator.clipboard.writeText(text).then(
    () => showToast('Setlist copied to clipboard!', 'success'),
    () => showToast('Failed to copy to clipboard', 'error')
  );
}

function openImportTextModal(store: Store): void {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';

  const content = document.createElement('div');
  content.className = 'modal-content';

  content.innerHTML = `
    <div class="modal-header">
      <h3>Import Setlist from Text</h3>
      <button class="btn-icon modal-close">✕</button>
    </div>
    <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
      <p style="font-size:0.9rem; color:var(--text-secondary);">Paste setlist text below (one song per line):</p>
      <textarea id="import-textarea" rows="8" style="width:100%; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:10px; font-family:var(--font-family);" placeholder="Song One&#10;Song Two&#10;Song Three"></textarea>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button class="btn btn-secondary cancel-btn">Cancel</button>
        <button class="btn btn-primary apply-btn">Import Setlist</button>
      </div>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  const closeBtn = content.querySelector('.modal-close') as HTMLElement;
  const cancelBtn = content.querySelector('.cancel-btn') as HTMLElement;
  const applyBtn = content.querySelector('.apply-btn') as HTMLElement;
  const textarea = content.querySelector('#import-textarea') as HTMLTextAreaElement;

  const closeModal = () => modal.remove();
  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;

  applyBtn.onclick = () => {
    const text = textarea.value;
    if (text.trim()) {
      store.dispatch({ type: 'setlist.import-text', text });
      showToast('Imported setlist order from text!', 'success');
      closeModal();
    }
  };
}

function promptSaveSetlist(store: Store): void {
  const name = prompt('Enter setlist name:', `Setlist-${new Date().toISOString().slice(0, 10)}`);
  if (name) {
    store.dispatch({ type: 'setlist.save', name });
    showToast(`Saved setlist "${name}"`, 'success');
  }
}

async function promptLoadSetlist(store: Store): Promise<void> {
  try {
    const res = await fetch('/api/setlist/files');
    const files: string[] = await res.json();
    if (files.length === 0) {
      showToast('No saved setlists found', 'info');
      return;
    }
    const selected = prompt(`Select setlist to load:\nAvailable:\n${files.join('\n')}`, files[0]);
    if (selected && files.includes(selected)) {
      store.dispatch({ type: 'setlist.load', name: selected });
      showToast(`Loaded setlist "${selected}"`, 'success');
    }
  } catch (err) {
    showToast('Failed to fetch setlist files', 'error');
  }
}
