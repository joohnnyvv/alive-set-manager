import { Component, Show, For } from 'solid-js';
import { store, dispatch } from '../state/store.js';
import SectionItem from '../components/SectionItem.js';

const SectionsView: Component = () => {
  const activeSong = () => store.setlist.songs.find(s => s.id === store.playback.activeSongId);

  return (
    <div class="view sections-view">
      <div class="view-header">
        <div>
          <h2 class="view-title">Song Sections</h2>
          <div class="subtitle">{activeSong() ? activeSong()!.name : 'No active song'}</div>
        </div>
      </div>

      <div class="sections-grid">
        <Show when={activeSong()?.sections?.length} fallback={
          <div class="empty-state">
            <div class="empty-icon">📑</div>
            <h3>No Sections</h3>
            <p>The active song has no defined section locators (&gt; Section Name).</p>
          </div>
        }>
          <For each={activeSong()!.sections}>
            {(section) => (
              <SectionItem
                section={section}
                isActive={store.playback.activeSectionId === section.id}
                isQueued={store.playback.queuedSectionId === section.id}
                sectionProgress={store.playback.activeSectionId === section.id ? store.playback.sectionProgress : 0}
                onClick={(sec) => dispatch({ type: 'jump-to-section', sectionId: sec.id })}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};

export default SectionsView;
