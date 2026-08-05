import { PlaybackState } from '../types.js';
import { logUi } from '../utils/logger.js';

/**
 * Renders transport controls.
 *
 * `getPlayback` is a LIVE getter that returns the current PlaybackState
 * at the moment it's called. This prevents stale closure bugs where
 * the Play/Pause button reads an outdated `isPlaying` value.
 */
export function renderTransportControls(
  getPlayback: () => PlaybackState,
  onPlay: () => void,
  onPause: () => void,
  onStop: () => void,
  onPrev: () => void,
  onNext: () => void,
  onGo: () => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'transport-controls';

  // Prev Button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn-transport btn-prev';
  prevBtn.innerHTML = '⏮';
  prevBtn.title = 'Previous Song';
  prevBtn.onclick = () => {
    logUi('Clicked Prev Song button');
    onPrev();
  };

  // Play / Pause Button — reads LIVE state on each click
  const playBtn = document.createElement('button');
  const pb = getPlayback();
  playBtn.className = `btn-transport btn-play ${pb.isPlaying ? 'is-playing' : ''}`;
  playBtn.innerHTML = pb.isPlaying ? '⏸' : '▶';
  playBtn.title = pb.isPlaying ? 'Pause' : 'Play';
  playBtn.onclick = () => {
    const live = getPlayback();
    if (live.isPlaying) {
      logUi('Clicked Pause button');
      onPause();
    } else {
      logUi('Clicked Play button');
      onPlay();
    }
  };

  // Stop Button
  const stopBtn = document.createElement('button');
  stopBtn.className = 'btn-transport btn-stop';
  stopBtn.innerHTML = '⏹';
  stopBtn.title = 'Stop';
  stopBtn.onclick = () => {
    logUi('Clicked Stop button');
    onStop();
  };

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn-transport btn-next';
  nextBtn.innerHTML = '⏭';
  nextBtn.title = 'Next Song';
  nextBtn.onclick = () => {
    logUi('Clicked Next Song button');
    onNext();
  };

  // GO Button (Smart Button)
  const goBtn = document.createElement('button');
  goBtn.className = 'btn-transport btn-go';

  const goState = computeGoState(pb);
  goBtn.innerHTML = `<span class="go-icon">${goState.icon}</span><span class="go-label">${goState.text}</span>`;
  goBtn.title = `Smart Action (${goState.text})`;
  goBtn.onclick = () => {
    const live = getPlayback();
    const gs = computeGoState(live);
    logUi(`Clicked GO button (State: ${gs.text})`);
    onGo();
  };

  container.appendChild(prevBtn);
  container.appendChild(playBtn);
  container.appendChild(stopBtn);
  container.appendChild(nextBtn);
  container.appendChild(goBtn);

  return container;
}

export function computeGoState(playback: PlaybackState): { text: string; icon: string } {
  if (playback.isPlaying && (playback.queuedSongId || playback.queuedSectionId)) {
    return { text: 'JUMP NOW', icon: '⚡' };
  } else if (playback.isPlaying && playback.isLooping) {
    return { text: 'ESCAPE LOOP', icon: '🔁' };
  } else if (playback.isPlaying) {
    return { text: 'NEXT', icon: '⏭' };
  } else if (!playback.isPlaying && playback.remainingTimeInSong <= 1) {
    return { text: 'NEXT SONG', icon: '⏭' };
  } else {
    return { text: 'PLAY', icon: '▶' };
  }
}
