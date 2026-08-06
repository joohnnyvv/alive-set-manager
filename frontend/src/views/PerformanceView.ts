import { Store } from '../state/store.js';
import { renderProgressBar } from '../components/ProgressBar.js';
import { renderTransportControls } from '../components/TransportControls.js';
import { renderQueueIndicator } from '../components/QueueIndicator.js';
import { renderSectionItem } from '../components/SectionItem.js';
import { formatClockTime, formatDuration } from '../utils/formatTime.js';
import { getCssColor } from '../utils/colors.js';
import { renderChordPills } from '../utils/chords.js';

export function renderPerformanceView(store: Store): HTMLElement {
  const view = document.createElement('div');
  view.className = 'view performance-view';

  const state = store.getState();
  const playback = state.playback;
  const setlist = state.setlist;

  const activeSong = setlist.songs.find(s => s.id === playback.activeSongId);
  const activeSection = activeSong?.sections.find(sec => sec.id === playback.activeSectionId);

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

    const label = document.createElement('div');
    label.className = 'now-playing-label';
    label.textContent = 'NOW PLAYING';

    const title = document.createElement('h1');
    title.className = 'now-playing-title';
    title.textContent = activeSong.name;

    nowPlayingCard.appendChild(label);
    nowPlayingCard.appendChild(title);

    if (activeSong.description) {
      const desc = document.createElement('div');
      desc.className = 'now-playing-desc';
      desc.textContent = `{${activeSong.description}}`;
      nowPlayingCard.appendChild(desc);
    }

    // Active Section & Chord Progression Card inside Hero
    const activeSectionBox = document.createElement('div');
    activeSectionBox.className = 'active-section-hero';

    if (activeSection) {
      const secName = document.createElement('div');
      secName.className = 'active-section-name';
      secName.innerHTML = `<span class="sec-label">SECTION:</span> <strong>${activeSection.name}</strong>`;
      activeSectionBox.appendChild(secName);

      if (activeSection.chords) {
        const chordContainer = document.createElement('div');
        chordContainer.className = 'hero-chord-container';
        const chordTitle = document.createElement('span');
        chordTitle.className = 'hero-chord-label';
        chordTitle.textContent = 'CHORDS:';
        const chordPills = renderChordPills(activeSection.chords, 'hero-chord-pills');
        chordContainer.appendChild(chordTitle);
        chordContainer.appendChild(chordPills);
        activeSectionBox.appendChild(chordContainer);
      }
    }
    nowPlayingCard.appendChild(activeSectionBox);
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

  // Song Sections & Chords Stage Strip
  if (activeSong && activeSong.sections && activeSong.sections.length > 0) {
    const sectionsCard = document.createElement('div');
    sectionsCard.className = 'stage-sections-card';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'stage-sections-header';
    cardHeader.innerHTML = `<span>Song Sections & Chord Progressions</span>`;
    sectionsCard.appendChild(cardHeader);

    const sectionsList = document.createElement('div');
    sectionsList.className = 'stage-sections-list';

    activeSong.sections.forEach(section => {
      const isActive = playback.activeSectionId === section.id;
      const isQueued = playback.queuedSectionId === section.id;

      const tile = renderSectionItem(
        section,
        isActive,
        isQueued,
        (sec) => store.dispatch({ type: 'jump-to-section', sectionId: sec.id })
      );
      sectionsList.appendChild(tile);
    });

    sectionsCard.appendChild(sectionsList);
    view.appendChild(sectionsCard);
  }

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
