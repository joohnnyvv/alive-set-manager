import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import type { Song, Section } from '../types.js';
import { getCssColor } from '../utils/colors.js';
import { formatDuration } from '../utils/formatTime.js';
import { logUi } from '../utils/logger.js';

interface SongItemProps {
  song: Song;
  index: number;
  isActive: boolean;
  isQueued: boolean;
  activeSectionId?: string;
  queuedSectionId?: string;
  onSongClick?: (song: Song) => void;
  onRemoveClick?: (song: Song) => void;
  onRestoreClick?: (song: Song) => void;
  onSectionClick?: (section: Section) => void;
  onEditClick?: (song: Song) => void;
  onDuplicateClick?: (song: Song) => void;
}

const stopLabelMap: Record<string, string> = {
  stop: '⏹ STOP',
  pause: '⏸ PAUSE',
};

const SongItem: Component<SongItemProps> = (props) => {
  const colorHex = () => getCssColor(props.song.color);
  const behavior = () => props.song.stopBehavior || 'default';
  const showStopBadge = () => behavior() !== 'default' && behavior() !== 'auto-jump';

  const handleHeaderClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.classList.contains('drag-handle')) {
      return;
    }
    logUi(`Clicked song item: "${props.song.name}" (id: ${props.song.id})`);
    props.onSongClick?.(props.song);
  };

  return (
    <div
      class="song-item"
      classList={{
        'is-active': props.isActive,
        'is-queued': props.isQueued,
        'is-skipped': props.song.isSkipped,
        'is-non-song': props.song.isNonSong,
        'is-duplicate': !!props.song.isDuplicate,
      }}
      data-id={props.song.id}
      style={{ '--song-color': colorHex() }}
    >
      <div class="song-header" onClick={handleHeaderClick}>
        {/* Title Box */}
        <div class="song-title-box">
          <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
          <span class="song-number">{props.song.isNonSong ? '—' : `${props.index + 1}.`}</span>
          <span class="song-name">{props.song.name}</span>

          {/* Stop Mode Badge */}
          <Show when={showStopBadge()}>
            <span
              class={`stop-mode-badge stop-mode-${behavior()}`}
              title={`Stop mode at song end: ${behavior()}`}
            >
              {stopLabelMap[behavior()] || behavior().toUpperCase()}
            </span>
          </Show>

          {/* Repeat / Duplicate Badge */}
          <Show when={props.song.isDuplicate}>
            <span class="duplicate-badge" title="Repeated song instance in setlist">
              ⧉ REPEAT
            </span>
          </Show>

          {/* Description */}
          <Show when={props.song.description}>
            <span class="song-description">{`{${props.song.description}}`}</span>
          </Show>

          {/* Tags */}
          <Show when={props.song.tags && props.song.tags.length > 0}>
            <div class="song-tags">
              <For each={props.song.tags}>
                {(tag) => <span class="tag-badge">{`#${tag}`}</span>}
              </For>
            </div>
          </Show>
        </div>

        {/* Right side: duration & action buttons */}
        <div class="song-right">
          <span class="song-duration">{formatDuration(props.song.duration)}</span>
          <Show
            when={props.song.isSkipped}
            fallback={
              <>
                <Show when={props.onDuplicateClick}>
                  <button
                    class="btn-icon btn-duplicate"
                    title="Duplicate / Repeat song in setlist"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onDuplicateClick?.(props.song);
                    }}
                  >
                    ⧉
                  </button>
                </Show>
                <Show when={props.onEditClick}>
                  <button
                    class="btn-icon btn-edit"
                    title="Song options"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onEditClick?.(props.song);
                    }}
                  >
                    ⚙
                  </button>
                </Show>
                <button
                  class="btn-icon btn-remove"
                  title={props.song.isDuplicate ? 'Remove duplicate song' : 'Skip song'}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onRemoveClick?.(props.song);
                  }}
                >
                  ✕
                </button>
              </>
            }
          >
            <button
              class="btn-icon btn-restore"
              title="Restore song"
              onClick={(e) => {
                e.stopPropagation();
                props.onRestoreClick?.(props.song);
              }}
            >
              ↩
            </button>
          </Show>
        </div>
      </div>

      {/* Sections List */}
      <Show when={props.song.sections && props.song.sections.length > 0}>
        <div class="song-sections-list">
          <For each={props.song.sections}>
            {(section) => {
              const isSecActive = () => props.activeSectionId === section.id;
              const isSecQueued = () => props.queuedSectionId === section.id;
              const secPrefix = section.flags?.quickJump ? '>> ' : '> ';

              return (
                <div
                  class="section-row"
                  classList={{
                    'is-active': isSecActive(),
                    'is-queued': isSecQueued(),
                    'is-skipped': section.flags?.skip,
                  }}
                  data-id={section.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    logUi(`Clicked section item: "${section.name}" (id: ${section.id})`);
                    props.onSectionClick?.(section);
                  }}
                >
                  {`${secPrefix}${section.name} (${formatDuration(section.duration)})`}
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default SongItem;
