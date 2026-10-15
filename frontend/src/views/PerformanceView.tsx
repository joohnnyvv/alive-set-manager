import { Component, createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { store, dispatch } from '../state/store.js';
import ProgressBar from '../components/ProgressBar.js';
import TransportControls from '../components/TransportControls.js';
import QueueIndicator from '../components/QueueIndicator.js';
import SectionItem from '../components/SectionItem.js';
import { formatClockTime, formatDuration } from '../utils/formatTime.js';
import { getCssColor } from '../utils/colors.js';
import { parseChordTokens } from '../utils/chords.js';

const PerformanceView: Component = () => {
  const [now, setNow] = createSignal(new Date());
  let clockTimer: ReturnType<typeof setInterval>;

  onMount(() => {
    clockTimer = setInterval(() => setNow(new Date()), 1000);
  });
  onCleanup(() => clearInterval(clockTimer));

  const activeSong = () => store.setlist.songs.find(s => s.id === store.playback.activeSongId);
  const activeSection = () => activeSong()?.sections.find(sec => sec.id === store.playback.activeSectionId);
  
  const activeSongs = () => store.setlist.songs.filter(s => !s.isSkipped);
  const nextSong = () => {
    const active = activeSong();
    const songs = activeSongs();
    if (!active) return songs[0];
    const currentIndex = songs.findIndex(s => s.id === active.id);
    if (currentIndex >= 0 && currentIndex < songs.length - 1) {
      return songs[currentIndex + 1];
    }
    return undefined;
  };

  const queueTargetLabel = () => {
    if (store.playback.queuedSectionId && activeSong()) {
      const sec = activeSong()!.sections.find(s => s.id === store.playback.queuedSectionId);
      if (sec) return sec.name;
    }
    if (store.playback.queuedSongId) {
      const s = store.setlist.songs.find(s => s.id === store.playback.queuedSongId);
      if (s) return s.name;
    }
    return 'Target';
  };

  const activeSongDuration = () => activeSong()?.duration || 0;
  const elapsedSongSeconds = () => activeSongDuration() * (store.playback.songProgress || 0);

  return (
    <div class="view performance-view">
      {/* Top bar */}
      <div class="stage-top-bar">
        <div class="stage-clock">{formatClockTime(now(), store.settings.show24HourClock)}</div>
        <div class="stage-tempo">BPM <strong>{Math.round(store.playback.tempo || 120)}</strong></div>
      </div>

      {/* Queue Banner */}
      <Show when={store.playback.queuedSongId || store.playback.queuedSectionId}>
        <QueueIndicator
          queuedName={queueTargetLabel()}
          onCancel={() => dispatch({ type: 'cancel-queue' })}
          onJumpNow={() => dispatch({ type: 'go' })}
        />
      </Show>

      <div class="stage-main">
        {/* Current song */}
        <div
          class="now-playing-card"
          style={{
            "border-left": activeSong() ? `4px solid ${getCssColor(activeSong()?.color)}` : 'none'
          }}
        >
          <Show
            when={activeSong()}
            fallback={
              <>
                <div class="now-playing-label">NO SONG PLAYING</div>
                <h1 class="now-playing-title">— Select a Song —</h1>
              </>
            }
          >
            <div class="now-playing-label">CURRENT SONG</div>
            <h1 class="now-playing-title">{activeSong()!.name}</h1>
            <Show when={activeSong()!.description}>
              <div class="now-playing-desc">{`{${activeSong()!.description}}`}</div>
            </Show>

            {/* Active section */}
            <div class="active-section-hero">
              <Show when={activeSection()}>
                <div class="active-section-name">
                  <span class="sec-label">SECTION:</span>
                  <strong>{` ${activeSection()!.name}`}</strong>
                </div>
              </Show>
            </div>
          </Show>
        </div>

        <aside class="stage-action-rail">
          {/* Next Song Card */}
          <div
            class="next-song-card"
            onClick={() => {
              const next = nextSong();
              if (next) dispatch({ type: 'jump-to-song', songId: next.id });
            }}
          >
            <span class="next-song-label">NEXT UP</span>
            <span class="next-song-name">{nextSong() ? nextSong()!.name : 'End of Set'}</span>
          </div>

          {/* Transport Controls */}
          <TransportControls
            playback={store.playback}
            onPlay={() => dispatch({ type: 'play' })}
            onPause={() => dispatch({ type: 'pause' })}
            onStop={() => dispatch({ type: 'stop' })}
            onPrev={() => dispatch({ type: 'prev-song' })}
            onNext={() => dispatch({ type: 'next-song' })}
            onGo={() => dispatch({ type: 'go' })}
          />
        </aside>
      </div>
      <Show when={activeSong()}>
        <Show when={activeSection()?.chords}>
          <div class="hero-chord-container">
            <span class="hero-chord-label">CHORDS:</span>
            <div class="hero-chord-pills">
              {parseChordTokens(activeSection()!.chords!).map((chord, idx, arr) => (
                <>
                  <span class="chord-pill">{chord}</span>
                  {idx < arr.length - 1 && <span class="chord-sep">—</span>}
                </>
              ))}
            </div>
          </div>
        </Show>
      </Show>

      {/* Progress Bar */}
      <ProgressBar
        progress={store.playback.songProgress || 0}
        elapsedSeconds={elapsedSongSeconds()}
        totalSeconds={activeSongDuration()}
        label={activeSong() ? `Song Progress (${formatDuration(store.playback.remainingTimeInSong || 0)} left)` : 'Set Idle'}
      />

      {/* Song Sections Strip */}
      <Show when={activeSong()?.sections && activeSong()!.sections.length > 0}>
        <div class="stage-sections-card">
          <div class="stage-sections-header">
            <span>Song Sections & Chord Progressions</span>
          </div>
          <div class="stage-sections-list">
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
          </div>
        </div>
      </Show>
    </div>
  );
};

export default PerformanceView;
