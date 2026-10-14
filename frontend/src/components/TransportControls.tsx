import type { Component } from 'solid-js';
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

interface TransportControlsProps {
  playback: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onGo: () => void;
}

const TransportControls: Component<TransportControlsProps> = (props) => {
  const goState = () => computeGoState(props.playback);

  return (
    <div class="transport-controls">
      <button class="btn-transport btn-prev" title="Previous Song" onClick={() => { logUi('Clicked Prev Song button'); props.onPrev(); }} innerHTML={SVG_ICONS.PREV}></button>
      <button
        class="btn-transport btn-play"
        classList={{ 'is-playing': props.playback.isPlaying }}
        title={props.playback.isPlaying ? 'Pause' : 'Play'}
        onClick={() => {
          if (props.playback.isPlaying) { logUi('Clicked Pause button'); props.onPause(); }
          else { logUi('Clicked Play button'); props.onPlay(); }
        }}
        innerHTML={props.playback.isPlaying ? SVG_ICONS.PAUSE : SVG_ICONS.PLAY}
      ></button>
      <button class="btn-transport btn-stop" title="Stop" onClick={() => { logUi('Clicked Stop button'); props.onStop(); }} innerHTML={SVG_ICONS.STOP}></button>
      <button class="btn-transport btn-next" title="Next Song" onClick={() => { logUi('Clicked Next Song button'); props.onNext(); }} innerHTML={SVG_ICONS.NEXT}></button>
      <button
        class="btn-transport btn-go"
        classList={{
          'is-queued': props.playback.isPlaying && !!(props.playback.queuedSongId || props.playback.queuedSectionId),
          'is-looping': props.playback.isPlaying && props.playback.isLooping && !(props.playback.queuedSongId || props.playback.queuedSectionId),
        }}
        title={`Smart Action (${goState().text})`}
        onClick={() => { logUi(`Clicked GO button (State: ${goState().text})`); props.onGo(); }}
      >
        <span class="go-icon" innerHTML={goState().icon}></span>
        <span class="go-label">{goState().text}</span>
      </button>
    </div>
  );
};

export default TransportControls;
