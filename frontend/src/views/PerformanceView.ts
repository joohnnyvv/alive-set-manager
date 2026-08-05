import { Store } from '../state/store.js';
import { renderProgressBar } from '../components/ProgressBar.js';
import { renderTransportControls } from '../components/TransportControls.js';
import { renderQueueIndicator } from '../components/QueueIndicator.js';
import { formatClockTime, formatDuration } from '../utils/formatTime.js';
import { getCssColor } from '../utils/colors.js';

export function renderPerformanceView(store: Store): HTMLElement {
  const view = document.createElement('div');
  view.className = 'view performance-view';

  const state = store.getState();
  const playback = state.playback;
  const setlist = state.setlist;

  const activeSong = setlist.songs.find(s => s.id === playback.activeSongId);

  // Find next non-skipped song
  const activeSongs = setlist.songs.filter(s => !s.isSkipped);
  let nextSong: any = undefined;
  if (activeSong) {
    const idx = activeSongs.findIndex(s => s.id === activeSong.id);
    if (idx !== -1 && idx + 1 < activeSongs.length) {
      nextSong = activeSongs[idx + 1];
    }
  } else if (activeSongs.length > 0) {
    nextSong = activeSongs[0];
  }

  // Top info bar: Clock & Status
  const topBar = document.createElement('div');
  topBar.className = 'stage-top-bar';

  const clockEl = document.createElement('div');
  clockEl.className = 'stage-clock';
  clockEl.textContent = formatClockTime(new Date(), state.settings.show24HourClock);

  const tempoEl = document.createElement('div');
  tempoEl.className = 'stage-tempo';
  tempoEl.innerHTML = `BPM <strong>${Math.round(playback.tempo)}</strong>`;

  topBar.appendChild(clockEl);
  topBar.appendChild(tempoEl);
  view.appendChild(topBar);

  // Queued Jump Banner
  if (playback.queuedSongId || playback.queuedSectionId) {
    const targetSong = setlist.songs.find(s => s.id === playback.queuedSongId);
    let targetSectionName: string | undefined;
    if (playback.queuedSectionId && activeSong) {
      const sec = activeSong.sections.find(s => s.id === playback.queuedSectionId);
      targetSectionName = sec?.name;
    }
    const targetLabel = targetSectionName || targetSong?.name || 'Target';

    const queueBanner = renderQueueIndicator(
      targetLabel,
      () => store.dispatch({ type: 'cancel-queue' }),
      () => store.dispatch({ type: 'go' })
    );
    view.appendChild(queueBanner);
  }

  // NOW PLAYING Hero Display
  const nowPlayingCard = document.createElement('div');
  nowPlayingCard.className = 'now-playing-card';

  if (activeSong) {
    const colorHex = getCssColor(activeSong.color);
    nowPlayingCard.style.borderLeft = `8px solid ${colorHex}`;

    nowPlayingCard.innerHTML = `
      <div class="now-playing-label">NOW PLAYING</div>
      <h1 class="now-playing-title">${activeSong.name}</h1>
      ${activeSong.description ? `<div class="now-playing-desc">{${activeSong.description}}</div>` : ''}
    `;
  } else {
    nowPlayingCard.innerHTML = `
      <div class="now-playing-label">NO SONG PLAYING</div>
      <h1 class="now-playing-title">— Select a Song —</h1>
    `;
  }
  view.appendChild(nowPlayingCard);

  // Progress Bar
  const activeSongDuration = activeSong ? activeSong.duration : 0;
  const elapsedSongSeconds = activeSongDuration * playback.songProgress;

  const progressBar = renderProgressBar(
    playback.songProgress,
    elapsedSongSeconds,
    activeSongDuration,
    activeSong ? `Song Progress (${formatDuration(playback.remainingTimeInSong)} left)` : 'Set Idle'
  );
  view.appendChild(progressBar);

  // Next Song Preview Card
  const nextSongCard = document.createElement('div');
  nextSongCard.className = 'next-song-card';
  nextSongCard.innerHTML = `
    <span class="next-song-label">NEXT:</span>
    <span class="next-song-name">${nextSong ? nextSong.name : 'End of Set'}</span>
  `;
  view.appendChild(nextSongCard);

  // Transport Controls — pass a getter so clicks always read LIVE state
  const transport = renderTransportControls(
    () => store.getState().playback,
    () => store.dispatch({ type: 'play' }),
    () => store.dispatch({ type: 'pause' }),
    () => store.dispatch({ type: 'stop' }),
    () => store.dispatch({ type: 'prev-song' }),
    () => store.dispatch({ type: 'next-song' }),
    () => store.dispatch({ type: 'go' })
  );
  view.appendChild(transport);

  return view;
}
