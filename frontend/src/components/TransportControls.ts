import { PlaybackState } from '../types.js';
import { logUi } from '../utils/logger.js';

export const SVG_ICONS = {
  PREV: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`,
  PLAY: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  PAUSE: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
  STOP: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>`,
  NEXT: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`,
  JUMP: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  LOOP: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 01-4 4H3"/></svg>`,
};

/**
 * Renders transport controls with SVG icons.
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
  prevBtn.innerHTML = SVG_ICONS.PREV;
  prevBtn.title = 'Previous Song';
  prevBtn.onclick = () => {
    logUi('Clicked Prev Song button');
    onPrev();
  };

  // Play / Pause Button
  const playBtn = document.createElement('button');
  const pb = getPlayback();
  playBtn.className = `btn-transport btn-play ${pb.isPlaying ? 'is-playing' : ''}`;
  playBtn.innerHTML = pb.isPlaying ? SVG_ICONS.PAUSE : SVG_ICONS.PLAY;
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
  stopBtn.innerHTML = SVG_ICONS.STOP;
  stopBtn.title = 'Stop';
  stopBtn.onclick = () => {
    logUi('Clicked Stop button');
    onStop();
  };

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn-transport btn-next';
  nextBtn.innerHTML = SVG_ICONS.NEXT;
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
    return { text: 'JUMP NOW', icon: SVG_ICONS.JUMP };
  } else if (playback.isPlaying && playback.isLooping) {
    return { text: 'ESCAPE LOOP', icon: SVG_ICONS.LOOP };
  } else if (playback.isPlaying) {
    return { text: 'NEXT', icon: SVG_ICONS.NEXT };
  } else if (!playback.isPlaying && playback.remainingTimeInSong <= 1) {
    return { text: 'NEXT SONG', icon: SVG_ICONS.NEXT };
  } else {
    return { text: 'PLAY', icon: SVG_ICONS.PLAY };
  }
}
