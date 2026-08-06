import { Section } from '../types.js';
import { formatDuration } from '../utils/formatTime.js';
import { getCssColor } from '../utils/colors.js';
import { logUi } from '../utils/logger.js';

import { renderChordPills } from '../utils/chords.js';

export function renderSectionItem(
  section: Section,
  isActive: boolean,
  isQueued: boolean,
  onClick: (section: Section) => void
): HTMLElement {
  const btn = document.createElement('button');
  btn.className = `btn-section-tile ${isActive ? 'is-active' : ''} ${isQueued ? 'is-queued' : ''} ${section.flags.skip ? 'is-skipped' : ''} ${section.flags.quickJump ? 'is-quick-jump' : ''}`;
  btn.dataset.id = section.id;

  const colorHex = getCssColor(section.color);
  btn.style.setProperty('--section-color', colorHex);

  const headerRow = document.createElement('div');
  headerRow.className = 'section-tile-header';

  const title = document.createElement('span');
  title.className = 'section-tile-name';
  title.textContent = (section.flags.quickJump ? '>> ' : '') + section.name;

  const duration = document.createElement('span');
  duration.className = 'section-tile-duration';
  duration.textContent = formatDuration(section.duration);

  headerRow.appendChild(title);
  headerRow.appendChild(duration);
  btn.appendChild(headerRow);

  if (section.chords) {
    const chordsEl = renderChordPills(section.chords, 'section-tile-chords');
    btn.appendChild(chordsEl);
  }

  // Section progress bar overlay inside tile
  const progressFill = document.createElement('div');
  progressFill.className = 'section-tile-progress';
  btn.appendChild(progressFill);

  btn.onclick = () => {
    logUi(`Clicked section tile: "${section.name}" (id: ${section.id})`);
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator && (navigator as any).userActivation?.hasBeenActive) {
        navigator.vibrate(25);
      }
    } catch {
      // Ignore intervention
    }
    btn.classList.add('is-tapped');
    setTimeout(() => btn.classList.remove('is-tapped'), 200);
    onClick(section);
  };

  return btn;
}
