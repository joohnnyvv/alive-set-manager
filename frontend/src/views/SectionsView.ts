import { Store } from '../state/store.js';
import { renderSectionItem } from '../components/SectionItem.js';

export function renderSectionsView(store: Store): HTMLElement {
  const view = document.createElement('div');
  view.className = 'view sections-view';

  const state = store.getState();
  const playback = state.playback;
  const setlist = state.setlist;

  const activeSong = setlist.songs.find(s => s.id === playback.activeSongId);

  // Header
  const header = document.createElement('div');
  header.className = 'view-header';

  const titleBox = document.createElement('div');
  titleBox.innerHTML = `
    <h2 class="view-title">Song Sections</h2>
    <div class="subtitle">${activeSong ? activeSong.name : 'No active song'}</div>
  `;

  header.appendChild(titleBox);
  view.appendChild(header);

  // Sections Grid
  const grid = document.createElement('div');
  grid.className = 'sections-grid';

  if (!activeSong || !activeSong.sections || activeSong.sections.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📑</div>
        <h3>No Sections</h3>
        <p>The active song has no defined section locators (&gt; Section Name).</p>
      </div>
    `;
  } else {
    activeSong.sections.forEach(section => {
      const isActive = playback.activeSectionId === section.id;
      const isQueued = playback.queuedSectionId === section.id;

      const tile = renderSectionItem(
        section,
        isActive,
        isQueued,
        (sec) => store.dispatch({ type: 'jump-to-section', sectionId: sec.id })
      );

      grid.appendChild(tile);
    });
  }

  view.appendChild(grid);

  return view;
}
