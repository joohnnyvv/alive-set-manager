import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { Section } from '../types.js';
import { formatDuration } from '../utils/formatTime.js';
import { getCssColor } from '../utils/colors.js';
import { logUi } from '../utils/logger.js';

interface SectionItemProps {
  section: Section;
  isActive: boolean;
  isQueued: boolean;
  sectionProgress?: number; // 0-1, for active section progress fill
  onClick: (section: Section) => void;
}

const SectionItem: Component<SectionItemProps> = (props) => {
  const colorHex = () => getCssColor(props.section.color);

  const handleClick = () => {
    logUi(`Clicked section tile: "${props.section.name}" (id: ${props.section.id})`);
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator && (navigator as any).userActivation?.hasBeenActive) {
        navigator.vibrate(25);
      }
    } catch { /* Ignore */ }
    props.onClick(props.section);
  };

  // For chord pills, render inline
  const chordTokens = () => {
    if (!props.section.chords) return [];
    return props.section.chords.split(/[\s\-\|,\/\>]+/).map(c => c.trim()).filter(c => c.length > 0);
  };

  return (
    <button
      class="btn-section-tile"
      classList={{
        'is-active': props.isActive,
        'is-queued': props.isQueued,
        'is-skipped': props.section.flags?.skip,
        'is-quick-jump': props.section.flags?.quickJump,
      }}
      data-id={props.section.id}
      style={{ '--section-color': colorHex() }}
      disabled={!!props.section.flags?.skip}
      onClick={handleClick}
    >
      <div class="section-tile-header">
        <span class="section-tile-name">{props.section.flags?.quickJump ? '>> ' : ''}{props.section.name}</span>
        <span class="section-tile-duration">{formatDuration(props.section.duration)}</span>
      </div>
      <Show when={props.section.chords && chordTokens().length > 0}>
        <div class="section-tile-chords">
          {chordTokens().map((chord, idx) => (
            <>
              <span class="chord-pill">{chord}</span>
              {idx < chordTokens().length - 1 && <span class="chord-sep">•</span>}
            </>
          ))}
        </div>
      </Show>
      <div class="section-tile-progress" style={{ width: props.isActive ? `${(props.sectionProgress ?? 0) * 100}%` : '0%' }}></div>
    </button>
  );
};

export default SectionItem;
