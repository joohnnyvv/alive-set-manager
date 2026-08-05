import { SetlistEngine } from './setlist.js';
import { AbletonBridge } from '../ableton/bridge.js';
import { Timekeeper } from './timekeeper.js';
import { SettingsStorage } from '../storage/settings.js';
import { Song, Section, JumpMode } from '../types/index.js';

export class JumpEngine {
  private queuedTarget?: { songId?: string; sectionId?: string; isSong: boolean };
  private activeScheduleId?: string;

  constructor(
    private setlistEngine: SetlistEngine,
    private abletonBridge: AbletonBridge,
    private timekeeper: Timekeeper,
    private settingsStorage: SettingsStorage,
    private onQueueChanged?: (songId?: string, sectionId?: string) => void
  ) {}

  public async requestSongJump(songId: string): Promise<void> {
    const song = this.setlistEngine.getSongById(songId);
    if (!song) {
      console.warn(`[JumpEngine] Song ID "${songId}" not found in setlist.`);
      return;
    }

    const isPlaying = this.abletonBridge.isPlaying();
    const jumpMode = this.settingsStorage.getSettings().jumpMode;
    console.log(`[JumpEngine] requestSongJump: "${song.name}" (isPlaying: ${isPlaying}, jumpMode: ${jumpMode})`);

    if (!isPlaying || jumpMode === 'quantized') {
      await this.executeSongJump(song);
      return;
    }

    // Queue the song jump
    this.queuedTarget = { songId: song.id, isSong: true };
    this.setlistEngine.setQueue(song.id, undefined);
    if (this.onQueueChanged) this.onQueueChanged(song.id, undefined);

    if (jumpMode === 'manual') {
      console.log(`[JumpEngine] Song "${song.name}" queued in manual mode. Waiting for GO button.`);
      return;
    }

    // For end-of-section, end-of-song, or dynamic mode
    this.scheduleQueuedJump();
  }

  public async requestSectionJump(sectionId: string): Promise<void> {
    const target = this.setlistEngine.getSectionById(sectionId);
    if (!target) return;
    const { song, section } = target;

    const isPlaying = this.abletonBridge.isPlaying();
    const jumpMode = this.settingsStorage.getSettings().jumpMode;

    if (!isPlaying || jumpMode === 'quantized') {
      await this.executeSectionJump(section);
      return;
    }

    // Queue the section jump
    this.queuedTarget = { songId: song.id, sectionId: section.id, isSong: false };
    this.setlistEngine.setQueue(song.id, section.id);
    if (this.onQueueChanged) this.onQueueChanged(song.id, section.id);

    if (jumpMode === 'manual') {
      return;
    }

    this.scheduleQueuedJump();
  }

  public cancelQueue(): void {
    if (this.activeScheduleId) {
      this.timekeeper.cancelEvent(this.activeScheduleId);
      this.activeScheduleId = undefined;
    }
    this.queuedTarget = undefined;
    this.setlistEngine.clearQueue();
    if (this.onQueueChanged) this.onQueueChanged(undefined, undefined);
  }

  public async executeQueuedNow(): Promise<void> {
    if (!this.queuedTarget) return;

    const { songId, sectionId, isSong } = this.queuedTarget;
    this.cancelQueue();

    if (isSong && songId) {
      const song = this.setlistEngine.getSongById(songId);
      if (song) await this.executeSongJump(song);
    } else if (sectionId) {
      const target = this.setlistEngine.getSectionById(sectionId);
      if (target) await this.executeSectionJump(target.section);
    }
  }

  private scheduleQueuedJump(): void {
    if (this.activeScheduleId) {
      this.timekeeper.cancelEvent(this.activeScheduleId);
    }

    const currentTime = this.abletonBridge.getCurrentSongTime();
    const active = this.setlistEngine.getActiveSongAndSection(currentTime);
    const jumpMode = this.settingsStorage.getSettings().jumpMode;

    let targetBoundaryBeats = currentTime;

    if (jumpMode === 'end-of-section' || (jumpMode === 'dynamic' && !this.queuedTarget?.isSong)) {
      // Jump at end of active section (or active song if no section)
      if (active.section) {
        targetBoundaryBeats = active.section.endTime;
      } else if (active.song) {
        targetBoundaryBeats = active.song.endTime;
      }
    } else if (jumpMode === 'end-of-song' || (jumpMode === 'dynamic' && this.queuedTarget?.isSong)) {
      // Jump at end of active song
      if (active.song) {
        targetBoundaryBeats = active.song.endTime;
      }
    }

    // AbleSet pre-activation trick: call jump ~0.08 beats (~50-100ms) BEFORE the boundary
    const preActivationBeats = Math.max(currentTime, targetBoundaryBeats - 0.08);

    this.activeScheduleId = this.timekeeper.scheduleAt(preActivationBeats, async () => {
      await this.executeQueuedNow();
    });
  }

  public async executeSongJump(song: Song): Promise<void> {
    console.log(`[JumpEngine] Executing song jump to "${song.name}"`);
    const targetCueId = song.sections.length > 0 ? song.sections[0].id : song.id;
    await this.abletonBridge.jumpToCue(targetCueId);

    if (!this.abletonBridge.isPlaying()) {
      await this.abletonBridge.safePlay();
    }
  }

  public async executeSectionJump(section: Section): Promise<void> {
    console.log(`[JumpEngine] Executing section jump to "${section.name}"`);
    await this.abletonBridge.jumpToCue(section.id);
    if (!this.abletonBridge.isPlaying()) {
      await this.abletonBridge.safePlay();
    }
  }

  public getQueuedTarget() {
    return this.queuedTarget;
  }
}
