import { Section } from '../types.js';
import { formatDuration } from '../utils/formatTime.js';
import { getCssColor } from '../utils/colors.js';

export function renderSectionItem(
  section: Section,
  isActive: boolean,
  isQueued: boolean,
  onClick: (section: Section) => void
): HTMLElement {
  const btn = document.createElement('button');
  btn.className = `btn-section-tile ${isActive ? 'is-active' : ''} ${isQueued ? 'is-queued' : ''} ${section.flags.skip ? 'is-skipped' : ''} ${section.flags.quickJump ? 'is-quick-jump' : ''}`;

  const colorHex = getCssColor(section.color);
  btn.style.setProperty('--section-color', colorHex);

  const title = document.createElement('span');
  title.className = 'section-tile-name';
  title.textContent = (section.flags.quickJump ? '>> ' : '') + section.name;

  const duration = document.createElement('span');
  duration.className = 'section-tile-duration';
  duration.textContent = formatDuration(section.duration);

  btn.appendChild(title);
  btn.appendChild(duration);

  btn.onclick = () => onClick(section);

  return btn;
}
