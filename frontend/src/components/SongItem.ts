import { Song, Section } from '../types.js';
import { getCssColor } from '../utils/colors.js';
import { formatDuration } from '../utils/formatTime.js';
import { logUi } from '../utils/logger.js';

export function renderSongItem(
  song: Song,
  index: number,
  isActive: boolean,
  isQueued: boolean,
  activeSectionId?: string,
  queuedSectionId?: string,
  onSongClick?: (song: Song) => void,
  onRemoveClick?: (song: Song) => void,
  onRestoreClick?: (song: Song) => void,
  onSectionClick?: (section: Section) => void,
  onEditClick?: (song: Song) => void,
  onDuplicateClick?: (song: Song) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = `song-item ${isActive ? 'is-active' : ''} ${isQueued ? 'is-queued' : ''} ${song.isSkipped ? 'is-skipped' : ''} ${song.isNonSong ? 'is-non-song' : ''} ${song.isDuplicate ? 'is-duplicate' : ''}`;
  container.dataset.id = song.id;

  const colorHex = getCssColor(song.color);
  container.style.setProperty('--song-color', colorHex);

  const header = document.createElement('div');
  header.className = 'song-header';

  // Drag handle
  const dragHandle = document.createElement('span');
  dragHandle.className = 'drag-handle';
  dragHandle.textContent = '⋮⋮';
  dragHandle.title = 'Drag to reorder';

  // Title Box
  const titleBox = document.createElement('div');
  titleBox.className = 'song-title-box';

  const songNum = document.createElement('span');
  songNum.className = 'song-number';
  songNum.textContent = song.isNonSong ? '—' : `${index + 1}.`;

  const songName = document.createElement('span');
  songName.className = 'song-name';
  songName.textContent = song.name;

  titleBox.appendChild(dragHandle);
  titleBox.appendChild(songNum);
  titleBox.appendChild(songName);

  // Stop Mode Badge (Compact & Understated)
  const behavior = song.stopBehavior || 'default';
  if (behavior !== 'default' && behavior !== 'auto-jump') {
    const stopBadge = document.createElement('span');
    const labelMap: Record<string, string> = {
      'stop': '⏹ STOP',
      'pause': '⏸ PAUSE',
    };
    stopBadge.className = `stop-mode-badge stop-mode-${behavior}`;
    stopBadge.textContent = labelMap[behavior] || behavior.toUpperCase();
    stopBadge.title = `Stop mode at song end: ${behavior}`;
    titleBox.appendChild(stopBadge);
  }

  // Repeat Badge for duplicated songs
  if (song.isDuplicate) {
    const dupBadge = document.createElement('span');
    dupBadge.className = 'duplicate-badge';
    dupBadge.textContent = '⧉ REPEAT';
    dupBadge.title = 'Repeated song instance in setlist';
    titleBox.appendChild(dupBadge);
  }

  if (song.description) {
    const desc = document.createElement('span');
    desc.className = 'song-description';
    desc.textContent = `{${song.description}}`;
    titleBox.appendChild(desc);
  }

  // Tags
  if (song.tags && song.tags.length > 0) {
    const tagsBox = document.createElement('div');
    tagsBox.className = 'song-tags';
    song.tags.forEach(tag => {
      const badge = document.createElement('span');
      badge.className = 'tag-badge';
      badge.textContent = `#${tag}`;
      tagsBox.appendChild(badge);
    });
    titleBox.appendChild(tagsBox);
  }

  // Right side: duration & action buttons
  const rightBox = document.createElement('div');
  rightBox.className = 'song-right';

  const durationLabel = document.createElement('span');
  durationLabel.className = 'song-duration';
  durationLabel.textContent = formatDuration(song.duration);
  rightBox.appendChild(durationLabel);

  if (song.isSkipped) {
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn-icon btn-restore';
    restoreBtn.textContent = '↩';
    restoreBtn.title = 'Restore song';
    restoreBtn.onclick = (e) => {
      e.stopPropagation();
      if (onRestoreClick) onRestoreClick(song);
    };
    rightBox.appendChild(restoreBtn);
  } else {
    if (onDuplicateClick) {
      const dupBtn = document.createElement('button');
      dupBtn.className = 'btn-icon btn-duplicate';
      dupBtn.textContent = '⧉';
      dupBtn.title = 'Duplicate / Repeat song in setlist';
      dupBtn.onclick = (e) => {
        e.stopPropagation();
        onDuplicateClick(song);
      };
      rightBox.appendChild(dupBtn);
    }

    if (onEditClick) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-icon btn-edit';
      editBtn.textContent = '⚙';
      editBtn.title = 'Song options';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        onEditClick(song);
      };
      rightBox.appendChild(editBtn);
    }

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-icon btn-remove';
    removeBtn.textContent = '✕';
    removeBtn.title = song.isDuplicate ? 'Remove duplicate song' : 'Skip song';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      if (onRemoveClick) onRemoveClick(song);
    };
    rightBox.appendChild(removeBtn);
  }

  header.appendChild(titleBox);
  header.appendChild(rightBox);

  header.onclick = (e) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).classList.contains('drag-handle')) {
      return;
    }
    logUi(`Clicked song item: "${song.name}" (id: ${song.id})`);
    if (onSongClick) onSongClick(song);
  };

  container.appendChild(header);

  // Sections accordion
  if (song.sections && song.sections.length > 0) {
    const sectionsBox = document.createElement('div');
    sectionsBox.className = 'song-sections-list';

    song.sections.forEach(section => {
      const isSecActive = activeSectionId === section.id;
      const isSecQueued = queuedSectionId === section.id;

      const secEl = document.createElement('div');
      secEl.className = `section-row ${isSecActive ? 'is-active' : ''} ${isSecQueued ? 'is-queued' : ''} ${section.flags.skip ? 'is-skipped' : ''}`;
      secEl.dataset.id = section.id;

      const secPrefix = section.flags.quickJump ? '>> ' : '> ';
      secEl.textContent = `${secPrefix}${section.name} (${formatDuration(section.duration)})`;

      secEl.onclick = (e) => {
        e.stopPropagation();
        logUi(`Clicked section item: "${section.name}" (id: ${section.id})`);
        if (onSectionClick) onSectionClick(section);
      };

      sectionsBox.appendChild(secEl);
    });

    container.appendChild(sectionsBox);
  }

  return container;
}
