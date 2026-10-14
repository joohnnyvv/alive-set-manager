import { PlaybackState } from '../types/index.js';
import { AbletonBridge } from '../ableton/bridge.js';
import { SetlistEngine } from './setlist.js';

export class PlaybackTracker {
  private lastSongId?: string;
  private lastSectionId?: string;

  constructor(
    private abletonBridge: AbletonBridge,
    private setlistEngine: SetlistEngine,
    private onSongChanged?: (songId: string, prevSongId?: string) => void,
    private onSectionChanged?: (sectionId: string, prevSectionId?: string) => void
  ) {}

  public getPlaybackState(): PlaybackState {
    const isPlaying = this.abletonBridge.isPlaying();
    const currentTime = this.abletonBridge.getCurrentSongTime();
    const tempo = this.abletonBridge.getTempo();
    const setlistState = this.setlistEngine.getSetlistState(tempo, currentTime, isPlaying);

    const active = this.setlistEngine.getActiveSongAndSection(currentTime);

    // Track active song/section changes
    if (active.song && active.song.id !== this.lastSongId) {
      if (this.onSongChanged) {
        this.onSongChanged(active.song.id, this.lastSongId);
      }
      this.lastSongId = active.song.id;
    }

    if (active.section && active.section.id !== this.lastSectionId) {
      if (this.onSectionChanged) {
        this.onSectionChanged(active.section.id, this.lastSectionId);
      }
      this.lastSectionId = active.section.id;
    }

    // Progress calculations
    let songProgress = 0;
    let remainingTimeInSong = 0;
    if (active.song) {
      const songLen = active.song.endTime - active.song.startTime;
      if (songLen > 0) {
        songProgress = Math.max(0, Math.min(1, (currentTime - active.song.startTime) / songLen));
      }
      remainingTimeInSong = Math.max(0, ((active.song.endTime - currentTime) / tempo) * 60);
    }

    let sectionProgress = 0;
    if (active.section) {
      const sectionLen = active.section.endTime - active.section.startTime;
      if (sectionLen > 0) {
        sectionProgress = Math.max(0, Math.min(1, (currentTime - active.section.startTime) / sectionLen));
      }
    }

    return {
      isPlaying,
      isPaused: !isPlaying && currentTime > 0,
      currentTime,
      tempo,
      activeSongId: active.song?.id,
      activeSectionId: active.section?.id,
      queuedSongId: setlistState.queuedSongId,
      queuedSectionId: setlistState.queuedSectionId,
      songProgress,
      sectionProgress,
      isLooping: this.abletonBridge.isLooping(),
      isCountingIn: false,
      remainingTimeInSong,
      remainingTimeInSet: setlistState.remainingTime,
    };
  }
}
