import { Component, For } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { store, setView, connection } from './state/store.js';
import SetlistView from './views/SetlistView.js';
import PerformanceView from './views/PerformanceView.js';
import SectionsView from './views/SectionsView.js';
import SettingsView from './views/SettingsView.js';

const viewMap = {
  setlist: SetlistView,
  performance: PerformanceView,
  sections: SectionsView,
  settings: SettingsView,
} as const;

const App: Component = () => {
  const navItems = [
    { view: 'setlist' as const, label: 'Setlist' },
    { view: 'performance' as const, label: 'Stage View' },
    { view: 'sections' as const, label: 'Sections' },
    { view: 'settings' as const, label: 'Settings' },
  ];

  const currentComponent = () => viewMap[store.currentView] || SetlistView;

  return (
    <>
      <header class="app-header">
        <div class="header-logo">
          <span class="logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12h3l3-9 4 18 3-9h4"/>
            </svg>
          </span>
          <span class="logo-text">Alive Set Manager</span>
        </div>
        <nav class="app-nav">
          <For each={navItems}>
            {(item) => (
              <button
                class="nav-btn"
                classList={{ 'is-active': store.currentView === item.view }}
                data-view={item.view}
                onClick={() => setView(item.view)}
              >
                {item.label}
              </button>
            )}
          </For>
        </nav>
        <div class="header-status">
          <span
            class={`status-dot status-${connection()}`}
            title={`WebSocket: ${connection()}`}
          ></span>
        </div>
      </header>
      <main id="app-content" class="app-content" classList={{ 'app-content-setlist': store.currentView === 'setlist' }}>
        <Dynamic component={currentComponent()} />
      </main>
    </>
  );
};

export default App;
