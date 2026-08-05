import { formatDuration } from '../utils/formatTime.js';

export function renderProgressBar(
  progress: number, // 0 to 1
  elapsedSeconds: number,
  totalSeconds: number,
  label: string = 'Song Progress'
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'progress-bar-container';

  const meta = document.createElement('div');
  meta.className = 'progress-meta';

  const labelEl = document.createElement('span');
  labelEl.className = 'progress-label';
  labelEl.textContent = label;

  const timeEl = document.createElement('span');
  timeEl.className = 'progress-time';
  timeEl.textContent = `${formatDuration(elapsedSeconds)} / ${formatDuration(totalSeconds)}`;

  meta.appendChild(labelEl);
  meta.appendChild(timeEl);

  const track = document.createElement('div');
  track.className = 'progress-track';

  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  const pct = Math.max(0, Math.min(100, progress * 100));
  fill.style.width = `${pct}%`;

  track.appendChild(fill);

  container.appendChild(meta);
  container.appendChild(track);

  return container;
}
