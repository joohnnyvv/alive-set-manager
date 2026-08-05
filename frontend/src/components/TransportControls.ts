import { PlaybackState } from '../types.js';
import { logUi } from '../utils/logger.js';

export function renderTransportControls(
  playback: PlaybackState,
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

  // Play / Pause Button
  const playBtn = document.createElement('button');
  playBtn.className = `btn-transport btn-play ${playback.isPlaying ? 'is-playing' : ''}`;
  playBtn.innerHTML = playback.isPlaying ? '⏸' : '▶';
  playBtn.title = playback.isPlaying ? 'Pause' : 'Play';
  playBtn.onclick = () => {
    if (playback.isPlaying) {
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

  let goText = 'GO';
  let goIcon = '▶';

  if (playback.isPlaying && (playback.queuedSongId || playback.queuedSectionId)) {
    goText = 'JUMP NOW';
    goIcon = '⚡';
    goBtn.classList.add('is-queued');
  } else if (playback.isPlaying && playback.isLooping) {
    goText = 'ESCAPE LOOP';
    goIcon = '🔁';
    goBtn.classList.add('is-looping');
  } else if (!playback.isPlaying && playback.remainingTimeInSong <= 1) {
    goText = 'NEXT SONG';
    goIcon = '⏭';
  } else if (!playback.isPlaying) {
    goText = 'PLAY';
    goIcon = '▶';
  }

  goBtn.innerHTML = `<span class="go-icon">${goIcon}</span><span class="go-label">${goText}</span>`;
  goBtn.title = `Smart Action (${goText})`;
  goBtn.onclick = () => {
    logUi(`Clicked GO button (State: ${goText})`);
    onGo();
  };

  container.appendChild(prevBtn);
  container.appendChild(playBtn);
  container.appendChild(stopBtn);
  container.appendChild(nextBtn);
  container.appendChild(goBtn);

  return container;
}
