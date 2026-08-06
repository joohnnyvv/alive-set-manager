import { store } from './state/store.js';
import { renderSetlistView } from './views/SetlistView.js';
import { renderPerformanceView } from './views/PerformanceView.js';
import { renderSectionsView } from './views/SectionsView.js';
import { renderSettingsView } from './views/SettingsView.js';
import { formatClockTime, formatDuration } from './utils/formatTime.js';
import { computeGoState, SVG_ICONS } from './components/TransportControls.js';

function initApp() {
  const root = document.getElementById('app');
  if (!root) return;

  root.innerHTML = `
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
  let activeQueueKey: string = '';
  let activeMidiKey: string = '';
  let lastActiveSongId: string | undefined = undefined;

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

    // Track setlist structure key (song count + order + skipped statuses)
    const currentSetlistKey = `${state.setlist.songs.length}_${state.setlist.order.join(',')}_${state.setlist.songs.map(s => s.id + (s.isSkipped ? ':skip' : '')).join('|')}`;
    const currentQueueKey = `${state.playback.queuedSongId || ''}_${state.playback.queuedSectionId || ''}`;
    const currentMidiKey = `${state.midi.learning ? state.midi.learningMappingId : 'idle'}_${state.midi.mappings.length}_${state.midi.mappings.map(m => m.id + ':' + m.inputName + ':' + m.messageType + ':' + m.channel + ':' + (m.note ?? '') + ':' + (m.cc ?? '')).join('|')}`;

    const activeSongChanged = state.playback.activeSongId !== lastActiveSongId;
    const queueChanged = currentQueueKey !== activeQueueKey;
    const midiChanged = currentMidiKey !== activeMidiKey;

    lastActiveSongId = state.playback.activeSongId;

    // ⭐ Rebuild DOM if view changed, DOM missing, setlist structure/skipped state changed, active song changed, queued target changed, or MIDI settings changed
    if (
      state.currentView !== activeViewName ||
      !activeViewEl ||
      currentSetlistKey !== activeSetlistKey ||
      activeSongChanged ||
      queueChanged ||
      midiChanged
    ) {
      activeViewName = state.currentView;
      activeSetlistKey = currentSetlistKey;
      activeQueueKey = currentQueueKey;
      activeMidiKey = currentMidiKey;
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
      // In-place updates for high-frequency ticks / smooth progress / live clocks
      updateViewInPlace(activeViewEl, state);
    }
  });
}

/**
 * Updates visual-only DOM properties in-place during high-frequency ticks.
 */
function updateViewInPlace(viewEl: HTMLElement, state: any) {
  const playback = state.playback;
  const setlist = state.setlist;

  // 1. Clock
  const clockEl = viewEl.querySelector('.stage-clock');
  if (clockEl) {
    clockEl.textContent = formatClockTime(new Date(), state.settings.show24HourClock);
  }

  // 2. Tempo / BPM
  const tempoStrong = viewEl.querySelector('.stage-tempo strong');
  if (tempoStrong) {
    const newTempo = String(Math.round(playback.tempo));
    if (tempoStrong.textContent !== newTempo) {
      tempoStrong.textContent = newTempo;
    }
  }

  // 3. Progress bar fill & text
  const progressFill = viewEl.querySelector('.progress-fill') as HTMLElement;
  if (progressFill) {
    progressFill.style.width = `${playback.songProgress * 100}%`;
  }

  const activeSong = setlist.songs.find((s: any) => s.id === playback.activeSongId);
  const activeSongDuration = activeSong ? activeSong.duration : 0;
  const elapsedSongSeconds = activeSongDuration * playback.songProgress;

  const progressTimeEl = viewEl.querySelector('.progress-time');
  if (progressTimeEl) {
    progressTimeEl.textContent = `${formatDuration(elapsedSongSeconds)} / ${formatDuration(activeSongDuration)}`;
  }

  const progressLabelEl = viewEl.querySelector('.progress-label');
  if (progressLabelEl) {
    if (activeSong) {
      progressLabelEl.textContent = `Song Progress (${formatDuration(playback.remainingTimeInSong)} left)`;
    } else {
      progressLabelEl.textContent = 'Set Idle';
    }
  }

  // 3b. Next Song Preview text
  const nextSongNameEl = viewEl.querySelector('.next-song-name');
  if (nextSongNameEl) {
    const activeSongs = setlist.songs.filter((s: any) => !s.isSkipped);
    let nxt: any = undefined;
    if (activeSong) {
      const idx = activeSongs.findIndex((s: any) => s.id === activeSong.id);
      if (idx !== -1 && idx + 1 < activeSongs.length) {
        nxt = activeSongs[idx + 1];
      }
    } else if (activeSongs.length > 0) {
      nxt = activeSongs[0];
    }
    const newNextName = nxt ? nxt.name : 'End of Set';
    if (nextSongNameEl.textContent !== newNextName) {
      nextSongNameEl.textContent = newNextName;
    }
  }

  // 4. Play / Pause Button state
  const playBtn = viewEl.querySelector('.btn-play') as HTMLElement;
  if (playBtn) {
    if (playback.isPlaying) {
      playBtn.classList.add('is-playing');
      playBtn.innerHTML = SVG_ICONS.PAUSE;
      playBtn.title = 'Pause';
    } else {
      playBtn.classList.remove('is-playing');
      playBtn.innerHTML = SVG_ICONS.PLAY;
      playBtn.title = 'Play';
    }
  }

  // 5. GO button state
  const goBtn = viewEl.querySelector('.btn-go') as HTMLElement;
  if (goBtn) {
    const gs = computeGoState(playback);
    const goIconSpan = goBtn.querySelector('.go-icon');
    const goLabelSpan = goBtn.querySelector('.go-label');
    if (goIconSpan && goIconSpan.innerHTML !== gs.icon) goIconSpan.innerHTML = gs.icon;
    if (goLabelSpan && goLabelSpan.textContent !== gs.text) goLabelSpan.textContent = gs.text;

    goBtn.className = 'btn-transport btn-go';
    if (playback.isPlaying && (playback.queuedSongId || playback.queuedSectionId)) {
      goBtn.classList.add('is-queued');
    } else if (playback.isPlaying && playback.isLooping) {
      goBtn.classList.add('is-looping');
    }
  }

  // 6. Setlist footer dynamic total set duration & remaining time
  const setlistFooter = viewEl.querySelector('.setlist-footer');
  if (setlistFooter) {
    setlistFooter.innerHTML = `
      <span>Total Set Duration: <strong>${formatDuration(setlist.totalDuration)}</strong></span>
      <span>Remaining: <strong>${formatDuration(setlist.remainingTime)}</strong></span>
    `;
  }

  // 7. Song items highlights
  const songItems = viewEl.querySelectorAll('.song-item');
  songItems.forEach((item) => {
    const id = (item as HTMLElement).dataset.id;
    if (id === playback.activeSongId) {
      item.classList.add('is-active');
    } else {
      item.classList.remove('is-active');
    }
  });

  // 8. Section tiles progress & highlights in Sections view
  const sectionTiles = viewEl.querySelectorAll('.btn-section-tile');
  sectionTiles.forEach((tile) => {
    const id = (tile as HTMLElement).dataset.id;
    const isAct = id === playback.activeSectionId;
    const isQd = id === playback.queuedSectionId;

    tile.classList.toggle('is-active', isAct);
    tile.classList.toggle('is-queued', isQd);

    const secProgressFill = tile.querySelector('.section-tile-progress') as HTMLElement;
    if (secProgressFill) {
      if (isAct) {
        secProgressFill.style.width = `${playback.sectionProgress * 100}%`;
      } else {
        secProgressFill.style.width = '0%';
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', initApp);
