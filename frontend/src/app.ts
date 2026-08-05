import { store } from './state/store.js';
import { renderSetlistView } from './views/SetlistView.js';
import { renderPerformanceView } from './views/PerformanceView.js';
import { renderSectionsView } from './views/SectionsView.js';
import { renderSettingsView } from './views/SettingsView.js';
import { formatClockTime, formatDuration } from './utils/formatTime.js';

function initApp() {
  const root = document.getElementById('app');
  if (!root) return;

  root.innerHTML = `
    <header class="app-header">
      <div class="header-logo">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">AbleSet Controller</span>
      </div>
      <nav class="app-nav">
        <button class="nav-btn" data-view="setlist">Setlist</button>
        <button class="nav-btn" data-view="performance">Stage View</button>
        <button class="nav-btn" data-view="sections">Sections</button>
        <button class="nav-btn" data-view="settings">Settings</button>
      </nav>
      <div class="header-status">
        <span id="header-conn-status" class="status-dot"></span>
      </div>
    </header>
    <main id="app-content" class="app-content"></main>
  `;

  const contentArea = document.getElementById('app-content') as HTMLElement;
  const navBtns = document.querySelectorAll('.nav-btn');
  const connDot = document.getElementById('header-conn-status') as HTMLElement;

  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = (btn as HTMLElement).dataset.view as any;
      store.setView(view);
    });
  });

  let activeViewName: string | null = null;
  let activeViewEl: HTMLElement | null = null;
  let activeSetlistKey: string = '';

  store.subscribe((state) => {
    // Update nav active state
    navBtns.forEach((btn) => {
      const v = (btn as HTMLElement).dataset.view;
      if (v === state.currentView) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });

    // Update connection status dot
    connDot.className = `status-dot status-${state.connection}`;
    connDot.title = `WebSocket: ${state.connection}`;

    // Track setlist structure key (song count + song order)
    const currentSetlistKey = `${state.setlist.songs.length}_${state.setlist.order.join(',')}`;

    // ⭐ Rebuild DOM only if active view changed, DOM missing, or setlist structure (order/songs) changed!
    if (state.currentView !== activeViewName || !activeViewEl || currentSetlistKey !== activeSetlistKey) {
      activeViewName = state.currentView;
      activeSetlistKey = currentSetlistKey;
      contentArea.innerHTML = '';

      switch (state.currentView) {
        case 'setlist':
          activeViewEl = renderSetlistView(store);
          break;
        case 'performance':
          activeViewEl = renderPerformanceView(store);
          break;
        case 'sections':
          activeViewEl = renderSectionsView(store);
          break;
        case 'settings':
          activeViewEl = renderSettingsView(store);
          break;
        default:
          activeViewEl = renderSetlistView(store);
      }

      contentArea.appendChild(activeViewEl);
    } else {
      // In-place updates for ticks / state changes without destroying DOM nodes
      updateViewInPlace(activeViewEl, state);
    }
  });
}

function updateViewInPlace(viewEl: HTMLElement, state: any) {
  const playback = state.playback;
  const setlist = state.setlist;

  // 1. Clock
  const clockEl = viewEl.querySelector('.stage-clock');
  if (clockEl) {
    clockEl.textContent = formatClockTime(new Date(), state.settings.show24HourClock);
  }

  // 2. Tempo
  const tempoEl = viewEl.querySelector('.stage-tempo');
  if (tempoEl) {
    tempoEl.innerHTML = `BPM <strong>${Math.round(playback.tempo)}</strong>`;
  }

  // 3. Active song / Now Playing
  const activeSong = setlist.songs.find((s: any) => s.id === playback.activeSongId);
  const nowPlayingTitle = viewEl.querySelector('.now-playing-title');
  if (nowPlayingTitle && activeSong) {
    if (nowPlayingTitle.textContent !== activeSong.name) {
      nowPlayingTitle.textContent = activeSong.name;
    }
  }

  // 4. Progress bar fill & text
  const progressFill = viewEl.querySelector('.progress-fill') as HTMLElement;
  if (progressFill) {
    progressFill.style.width = `${playback.songProgress * 100}%`;
  }

  const progressTimeText = viewEl.querySelector('.progress-time-text');
  if (progressTimeText) {
    const activeSongDuration = activeSong ? activeSong.duration : 0;
    const elapsedSongSeconds = activeSongDuration * playback.songProgress;
    progressTimeText.textContent = `${formatDuration(elapsedSongSeconds)} / ${formatDuration(activeSongDuration)}`;
  }

  // 5. Play / Pause Button state
  const playBtn = viewEl.querySelector('.btn-play') as HTMLElement;
  if (playBtn) {
    if (playback.isPlaying) {
      playBtn.classList.add('is-playing');
      playBtn.innerHTML = '⏸';
      playBtn.title = 'Pause';
    } else {
      playBtn.classList.remove('is-playing');
      playBtn.innerHTML = '▶';
      playBtn.title = 'Play';
    }
  }

  // 6. GO button state
  const goBtn = viewEl.querySelector('.btn-go') as HTMLElement;
  if (goBtn) {
    let goText = 'GO';
    let goIcon = '▶';
    if (playback.isPlaying && (playback.queuedSongId || playback.queuedSectionId)) {
      goText = 'JUMP NOW';
      goIcon = '⚡';
      goBtn.className = 'btn-transport btn-go is-queued';
    } else if (playback.isPlaying && playback.isLooping) {
      goText = 'ESCAPE LOOP';
      goIcon = '🔁';
      goBtn.className = 'btn-transport btn-go is-looping';
    } else if (!playback.isPlaying && playback.remainingTimeInSong <= 1) {
      goText = 'NEXT SONG';
      goIcon = '⏭';
      goBtn.className = 'btn-transport btn-go';
    } else if (!playback.isPlaying) {
      goText = 'PLAY';
      goIcon = '▶';
      goBtn.className = 'btn-transport btn-go';
    }
    goBtn.innerHTML = `<span class="go-icon">${goIcon}</span><span class="go-label">${goText}</span>`;
  }

  // 7. Active song row highlights in setlist & sections views
  const songItems = viewEl.querySelectorAll('.song-item');
  songItems.forEach((item) => {
    const id = (item as HTMLElement).dataset.id;
    if (id === playback.activeSongId) {
      item.classList.add('is-active');
    } else {
      item.classList.remove('is-active');
    }
  });

  const sectionRows = viewEl.querySelectorAll('.section-row');
  sectionRows.forEach((row) => {
    const id = (row as HTMLElement).dataset.id;
    if (id === playback.activeSectionId) {
      row.classList.add('is-active');
    } else {
      row.classList.remove('is-active');
    }
  });
}

document.addEventListener('DOMContentLoaded', initApp);
