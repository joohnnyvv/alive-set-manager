import { createSignal, For, Show } from 'solid-js';
import { store, dispatch } from '../state/store.js';
import SongItem from '../components/SongItem.js';
import { showToast } from '../components/Toast.js';
import { apiFetch } from '../api/http.js';
import { formatDuration } from '../utils/formatTime.js';
import type { Song, Section, StopBehavior } from '../types.js';

export default function SetlistView() {
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [showEditModal, setShowEditModal] = createSignal(false);
  const [showSaveModal, setShowSaveModal] = createSignal(false);
  const [showLoadModal, setShowLoadModal] = createSignal(false);
  const [showImportModal, setShowImportModal] = createSignal(false);

  const [searchQuery, setSearchQuery] = createSignal('');
  const [editingSong, setEditingSong] = createSignal<Song | null>(null);
  const [editColor, setEditColor] = createSignal('');
  const [editStopBehavior, setEditStopBehavior] = createSignal<StopBehavior>('default');
  const [saveName, setSaveName] = createSignal('');
  const [loadFiles, setLoadFiles] = createSignal<string[]>([]);
  const [selectedLoadFile, setSelectedLoadFile] = createSignal('');
  const [importText, setImportText] = createSignal('');

  let draggedId: string | null = null;

  const filteredSongs = () => {
    const q = searchQuery().toLowerCase().trim();
    return store.setlist.songs.filter((s: Song) => {
      if (!q) return true;
      if (q.startsWith('#')) {
        const tag = q.substring(1);
        return s.tags && s.tags.some(t => t.toLowerCase().includes(tag));
      }
      return s.name.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q));
    });
  };

  const copySetlistAsText = () => {
    const songNames = store.setlist.songs.filter((s: Song) => !s.isSkipped).map((s: Song) => s.name);
    navigator.clipboard.writeText(songNames.join('\n')).then(
      () => showToast('Setlist copied to clipboard!', 'success'),
      () => showToast('Failed to copy to clipboard', 'error')
    );
  };

  const handleOpenEdit = (song: Song) => {
    setEditingSong(song);
    setEditColor(song.color || '');
    setEditStopBehavior(song.stopBehavior || 'default');
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    const song = editingSong();
    if (song) {
      dispatch({
        type: 'setlist.update-song',
        songId: song.id,
        overrides: {
          color: editColor() || undefined,
          stopBehavior: editStopBehavior(),
        },
      });
      showToast(`Updated "${song.name}"`, 'success');
    }
    setShowEditModal(false);
  };

  return (
    <div class="view setlist-view">
      <div class="view-header">
        <h2 class="view-title">Setlist</h2>
        <div class="header-actions">
          <button class="btn btn-primary" onClick={() => setShowAddModal(true)}>Add Song</button>
          <button class="btn btn-secondary" onClick={() => { setSaveName(''); setShowSaveModal(true); }}>Save</button>
          <button class="btn btn-secondary" onClick={() => {
            setShowLoadModal(true);
            apiFetch('/api/setlist/files')
              .then((res) => res.json())
              .then((files: string[]) => {
                setLoadFiles(files || []);
                if (files && files.length > 0) setSelectedLoadFile(files[0]);
              })
              .catch(() => showToast('Failed to load setlist files', 'error'));
          }}>Load</button>
          <button class="btn btn-secondary" onClick={copySetlistAsText}>Copy Text</button>
          <button class="btn btn-secondary" onClick={() => { setImportText(''); setShowImportModal(true); }}>Import Text</button>
        </div>
      </div>

      <div class="setlist-container">
        <Show when={store.setlist.songs && store.setlist.songs.length > 0} fallback={
          <div class="empty-state">
            <div class="empty-icon" innerHTML={`<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`}>
            </div>
            <h3>No Songs Available</h3>
            <p>Connect Ableton Live with Cue Point locators or add songs manually.</p>
          </div>
        }>
          <For each={store.setlist.songs}>
            {(song, idx) => (
              <div
                draggable={true}
                onDragStart={(e) => {
                  draggedId = song.id;
                  e.dataTransfer?.setData('text/plain', song.id);
                  e.currentTarget.classList.add('is-dragging');
                }}
                onDragEnd={(e) => {
                  e.currentTarget.classList.remove('is-dragging');
                  draggedId = null;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('drag-over');
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('drag-over');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('drag-over');
                  const sourceId = draggedId || e.dataTransfer?.getData('text/plain');
                  if (sourceId && sourceId !== song.id) {
                    const currentOrder = [...store.setlist.order];
                    const fromIdx = currentOrder.indexOf(sourceId);
                    const toIdx = currentOrder.indexOf(song.id);
                    if (fromIdx !== -1 && toIdx !== -1) {
                      currentOrder.splice(fromIdx, 1);
                      currentOrder.splice(toIdx, 0, sourceId);
                      dispatch({ type: 'setlist.reorder', order: currentOrder });
                    }
                  }
                }}
              >
                <SongItem
                  song={song}
                  index={idx()}
                  isActive={store.setlist.activeSongId === song.id}
                  isQueued={store.setlist.queuedSongId === song.id}
                  activeSectionId={store.setlist.activeSectionId}
                  queuedSectionId={store.setlist.queuedSectionId}
                  onSongClick={(s) => dispatch({ type: 'jump-to-song', songId: s.id })}
                  onRemoveClick={(s) => dispatch({ type: 'setlist.remove-song', songId: s.id })}
                  onRestoreClick={(s) => dispatch({ type: 'setlist.restore-song', songId: s.id })}
                  onSectionClick={(sec) => dispatch({ type: 'jump-to-section', sectionId: sec.id })}
                  onEditClick={handleOpenEdit}
                  onDuplicateClick={(s) => {
                    dispatch({ type: 'setlist.duplicate-song', songId: s.id });
                    showToast(`Duplicated "${s.name}" in setlist`, 'success');
                  }}
                />
              </div>
            )}
          </For>
        </Show>
      </div>

      <div class="setlist-footer">
        <span>Total Set Duration: <strong>{formatDuration(store.setlist.totalDuration || 0)}</strong></span>
        <span>Remaining: <strong>{formatDuration(store.setlist.remainingTime || 0)}</strong></span>
      </div>

      {/* Add Song Modal */}
      <Show when={showAddModal()}>
        <div class="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div class="modal-content">
            <div class="modal-header">
              <h3>Add Song to Setlist</h3>
              <button class="btn-icon modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div class="modal-body">
              <input
                type="text"
                class="input-search"
                placeholder="Search songs by name or tag (#rock)..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                autofocus
              />
              <div class="search-results-list">
                <Show when={filteredSongs().length > 0} fallback={<div class="empty-search">No matching songs found</div>}>
                  <For each={filteredSongs()}>
                    {(song) => (
                      <div class="search-result-item">
                        <div>
                          <strong>{song.name}</strong>
                          <Show when={song.description}>
                            <small>{` {${song.description}}`}</small>
                          </Show>
                        </div>
                        <button
                          class="btn btn-sm btn-primary"
                          onClick={() => {
                            if (song.isSkipped) {
                              dispatch({ type: 'setlist.restore-song', songId: song.id });
                              showToast(`Restored "${song.name}" to setlist`, 'success');
                            } else {
                              const newOrder = [...store.setlist.order, song.id];
                              dispatch({ type: 'setlist.reorder', order: newOrder });
                              showToast(`Added "${song.name}" to setlist`, 'success');
                            }
                            setShowAddModal(false);
                          }}
                        >
                          {song.isSkipped ? 'Restore' : 'Add'}
                        </button>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Edit Song Modal */}
      <Show when={showEditModal()}>
        <div class="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
          <div class="modal-content">
            <div class="modal-header">
              <h3>Edit Song: {editingSong()?.name}</h3>
              <button class="btn-icon modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <div class="modal-body" style={{ display: 'flex', 'flex-direction': 'column', gap: '14px' }}>
              <div class="setting-row">
                <label>Stop Behavior</label>
                <select
                  class="select-input"
                  value={editStopBehavior()}
                  onChange={(e) => setEditStopBehavior(e.currentTarget.value as StopBehavior)}
                >
                  <option value="default">Default (Play through)</option>
                  <option value="auto-jump">Auto-Jump to Next Song</option>
                  <option value="stop">Stop at Song End</option>
                  <option value="pause">Pause at Song End</option>
                </select>
              </div>
              <div class="setting-row">
                <label>Color Override</label>
                <input
                  type="text"
                  class="input-search"
                  placeholder="e.g. red, blue, emerald"
                  value={editColor()}
                  onInput={(e) => setEditColor(e.currentTarget.value)}
                />
              </div>
              <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '10px', 'margin-top': '10px' }}>
                <button class="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button class="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Save Setlist Modal */}
      <Show when={showSaveModal()}>
        <div class="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowSaveModal(false); }}>
          <div class="modal-content">
            <div class="modal-header">
              <h3>Save Setlist</h3>
              <button class="btn-icon modal-close" onClick={() => setShowSaveModal(false)}>✕</button>
            </div>
            <div class="modal-body" style={{ display: 'flex', 'flex-direction': 'column', gap: '14px' }}>
              <input
                type="text"
                class="input-search"
                placeholder="Setlist Name (e.g. Friday Night Live)"
                value={saveName()}
                onInput={(e) => setSaveName(e.currentTarget.value)}
                autofocus
              />
              <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '10px' }}>
                <button class="btn btn-secondary" onClick={() => setShowSaveModal(false)}>Cancel</button>
                <button
                  class="btn btn-primary"
                  onClick={() => {
                    const name = saveName().trim();
                    if (!name) {
                      showToast('Please enter a setlist name', 'error');
                      return;
                    }
                    dispatch({ type: 'setlist.save', name });
                    setShowSaveModal(false);
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Load Setlist Modal */}
      <Show when={showLoadModal()}>
        <div class="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowLoadModal(false); }}>
          <div class="modal-content">
            <div class="modal-header">
              <h3>Load Saved Setlist</h3>
              <button class="btn-icon modal-close" onClick={() => setShowLoadModal(false)}>✕</button>
            </div>
            <div class="modal-body" style={{ display: 'flex', 'flex-direction': 'column', gap: '14px' }}>
              <Show when={loadFiles().length > 0} fallback={<div class="empty-search">No saved setlists found on server</div>}>
                <select
                  class="select-input"
                  value={selectedLoadFile()}
                  onChange={(e) => setSelectedLoadFile(e.currentTarget.value)}
                >
                  <For each={loadFiles()}>
                    {(file) => <option value={file}>{file}</option>}
                  </For>
                </select>
                <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '10px' }}>
                  <button class="btn btn-secondary" onClick={() => setShowLoadModal(false)}>Cancel</button>
                  <button
                    class="btn btn-primary"
                    onClick={() => {
                      if (selectedLoadFile()) {
                        dispatch({ type: 'setlist.load', name: selectedLoadFile() });
                        showToast(`Loaded setlist "${selectedLoadFile()}"`, 'success');
                      }
                      setShowLoadModal(false);
                    }}
                  >
                    Load
                  </button>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Show>

      {/* Import Text Modal */}
      <Show when={showImportModal()}>
        <div class="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowImportModal(false); }}>
          <div class="modal-content">
            <div class="modal-header">
              <h3>Import Setlist from Text</h3>
              <button class="btn-icon modal-close" onClick={() => setShowImportModal(false)}>✕</button>
            </div>
            <div class="modal-body" style={{ display: 'flex', 'flex-direction': 'column', gap: '14px' }}>
              <p style={{ color: 'var(--text-secondary)', 'font-size': '0.85rem', margin: 0 }}>
                Paste song names separated by newlines. The setlist will reorder to match.
              </p>
              <textarea
                class="input-search"
                style={{ 'min-height': '160px', 'font-family': 'monospace' }}
                placeholder="Song 1&#10;Song 2&#10;Song 3..."
                value={importText()}
                onInput={(e) => setImportText(e.currentTarget.value)}
              ></textarea>
              <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '10px' }}>
                <button class="btn btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
                <button
                  class="btn btn-primary"
                  onClick={() => {
                    const text = importText().trim();
                    if (!text) {
                      showToast('Please enter text to import', 'error');
                      return;
                    }
                    dispatch({ type: 'setlist.import-text', text });
                    showToast('Imported setlist text!', 'success');
                    setShowImportModal(false);
                  }}
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
