import { Song, Section, Setlist, StopBehavior, ParsedLocator } from '../types/index.js';
import { parseLocator } from '../parsers/locator.js';
import { RawCuePoint } from '../ableton/bridge.js';

export class SetlistEngine {
  private songs: Song[] = [];
  private order: string[] = [];
  private activeSongId?: string;
  private activeSectionId?: string;
  private queuedSongId?: string;
  private queuedSectionId?: string;

  public buildSetlistFromCues(cuePoints: RawCuePoint[], tempo: number = 120): Setlist {
    // 1. Sort cue points by time ascending
    const sorted = [...cuePoints].sort((a, b) => a.time - b.time);

    // 2. Parse each locator
    const parsedLocators: (ParsedLocator & { id: string })[] = sorted.map(cue => ({
      ...parseLocator(cue.name, cue.time),
      id: cue.id,
    }));

    // Filter out ignored locators
    const activeLocators = parsedLocators.filter(loc => loc.type !== 'ignored');

    const songs: Song[] = [];

    let currentSong: Song | null = null;
    let currentSections: Section[] = [];

    for (let i = 0; i < activeLocators.length; i++) {
      const loc = activeLocators[i];
      const nextLoc = activeLocators[i + 1];

      if (loc.type === 'song') {
        // If we were building a previous song, finalize it
        if (currentSong) {
          currentSong.endTime = loc.time;
          const effTempo = currentSong.targetTempo || tempo;
          currentSong.duration = currentSong.duration || Math.max(0, ((loc.time - currentSong.startTime) / effTempo) * 60);
          currentSong.sections = currentSections;
          songs.push(currentSong);
        }

        // Determine stop behavior from locator flags
        let stopBehavior: StopBehavior = 'default';
        if (loc.flags.stay || loc.flags.pause) {
          stopBehavior = 'pause';
        } else if (loc.flags.jump) {
          stopBehavior = 'stop';
        }

        // Start new song
        currentSong = {
          id: loc.id,
          name: loc.name,
          description: loc.description,
          startTime: loc.time,
          endTime: loc.time + 16, // fallback, updated by next locator or SONG END
          duration: loc.duration || 0,
          targetTempo: loc.targetTempo,
          color: loc.color,
          tags: loc.tags,
          sections: [],
          stopBehavior,
          isNonSong: loc.flags.nosong,
          isSkipped: loc.flags.skip,
        };
        currentSections = [];
      } else if (loc.type === 'section') {
        const nextTime = nextLoc ? nextLoc.time : loc.time + 16;
        const sectionDuration = Math.max(0, ((nextTime - loc.time) / tempo) * 60);

        const section: Section = {
          id: loc.id,
          name: loc.name,
          description: loc.description,
          startTime: loc.time,
          endTime: nextTime,
          duration: sectionDuration,
          color: loc.color,
          flags: loc.flags,
          transitionTarget: loc.transitionTarget,
        };

        if (currentSong) {
          currentSections.push(section);
        }
      } else if (loc.type === 'song-end' || loc.type === 'stop') {
        if (currentSong) {
          currentSong.endTime = loc.time;
          const effTempo = currentSong.targetTempo || tempo;
          currentSong.duration = currentSong.duration || Math.max(0, ((loc.time - currentSong.startTime) / effTempo) * 60);
          if (loc.type === 'stop') {
            currentSong.stopBehavior = 'stop';
          }
          currentSong.sections = currentSections;
          songs.push(currentSong);
          currentSong = null;
          currentSections = [];
        }
      }
    }

    // Finalize last song if any
    if (currentSong) {
      const lastLoc = activeLocators[activeLocators.length - 1];
      const fallbackEnd = lastLoc ? lastLoc.time + 32 : currentSong.startTime + 64;
      currentSong.endTime = fallbackEnd;
      const effTempo = currentSong.targetTempo || tempo;
      currentSong.duration = currentSong.duration || Math.max(0, ((fallbackEnd - currentSong.startTime) / effTempo) * 60);
      currentSong.sections = currentSections;
      songs.push(currentSong);
    }

    // Assign / update order
    this.songs = songs;
    const existingOrderSet = new Set(this.order);
    const newSongIds = songs.map(s => s.id);
    
    // Preserve existing order for songs that still exist, append new ones
    const updatedOrder = this.order.filter(id => newSongIds.includes(id));
    for (const id of newSongIds) {
      if (!updatedOrder.includes(id)) {
        updatedOrder.push(id);
      }
    }
    this.order = updatedOrder;

    return this.getSetlistState(tempo, 0, false);
  }

  public getSetlistState(tempo: number = 120, currentTime: number = 0, isPlaying: boolean = false): Setlist {
    const songMap = new Map(this.songs.map(s => [s.id, s]));
    const orderedSongs = this.order.map(id => songMap.get(id)).filter((s): s is Song => s !== undefined);

    // Calculate tempo-aware dynamic durations for each song and section
    for (const song of orderedSongs) {
      const effTempo = song.targetTempo || tempo;
      const beatLength = Math.max(0, song.endTime - song.startTime);
      song.duration = (beatLength / effTempo) * 60;

      for (const sec of song.sections) {
        const secBeatLength = Math.max(0, sec.endTime - sec.startTime);
        sec.duration = (secBeatLength / effTempo) * 60;
      }
    }

    // Calculate active song and section from playhead
    const active = this.getActiveSongAndSection(currentTime);
    this.activeSongId = active.song?.id;
    this.activeSectionId = active.section?.id;

    // Total duration of active (non-skipped) songs
    const activeSongs = orderedSongs.filter(s => !s.isSkipped);
    const totalDuration = activeSongs.reduce((sum, s) => sum + s.duration, 0);

    // Remaining set time
    let remainingTime = 0;
    if (active.song) {
      const currentSongIndex = activeSongs.findIndex(s => s.id === active.song?.id);
      if (currentSongIndex !== -1) {
        const remainingInCurrent = Math.max(0, ((active.song.endTime - currentTime) / tempo) * 60);
        const remainingInFuture = activeSongs.slice(currentSongIndex + 1).reduce((sum, s) => sum + s.duration, 0);
        remainingTime = remainingInCurrent + remainingInFuture;
      }
    }

    return {
      songs: orderedSongs,
      order: [...this.order],
      activeSongId: this.activeSongId,
      activeSectionId: this.activeSectionId,
      queuedSongId: this.queuedSongId,
      queuedSectionId: this.queuedSectionId,
      isPlaying,
      currentTime,
      tempo,
      totalDuration,
      remainingTime,
    };
  }

  public getActiveSongAndSection(currentTime: number): { song?: Song; section?: Section } {
    // Find song where currentTime falls into [startTime, endTime)
    const song = this.songs.find(s => currentTime >= s.startTime - 0.01 && currentTime < s.endTime - 0.01);
    if (!song) {
      return { song: undefined, section: undefined };
    }

    const section = song.sections.find(sec => currentTime >= sec.startTime - 0.01 && currentTime < sec.endTime - 0.01);
    return { song, section };
  }

  public reorder(newOrder: string[]): void {
    // Filter to only valid song IDs
    const validIds = new Set(this.songs.map(s => s.id));
    this.order = newOrder.filter(id => validIds.has(id));
  }

  public removeSong(songId: string): void {
    const song = this.songs.find(s => s.id === songId);
    if (song) {
      song.isSkipped = true;
    }
  }

  public restoreSong(songId: string): void {
    const song = this.songs.find(s => s.id === songId);
    if (song) {
      song.isSkipped = false;
    }
  }

  public setQueue(songId?: string, sectionId?: string): void {
    this.queuedSongId = songId;
    this.queuedSectionId = sectionId;
  }

  public clearQueue(): void {
    this.queuedSongId = undefined;
    this.queuedSectionId = undefined;
  }

  public getSongById(songId: string): Song | undefined {
    return this.songs.find(s => s.id === songId);
  }

  public updateSongOverride(songId: string, overrides: { color?: string; stopBehavior?: StopBehavior; duration?: number }): void {
    const song = this.songs.find(s => s.id === songId);
    if (song) {
      if (overrides.color !== undefined) song.color = overrides.color;
      if (overrides.stopBehavior !== undefined) song.stopBehavior = overrides.stopBehavior;
      if (overrides.duration !== undefined) song.duration = overrides.duration;
    }
  }

  public importFromText(text: string): void {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const newOrder: string[] = [];

    for (const line of lines) {
      const match = this.songs.find(s => s.name.toLowerCase() === line.toLowerCase());
      if (match) {
        newOrder.push(match.id);
        match.isSkipped = false;
      }
    }

    if (newOrder.length > 0) {
      this.order = newOrder;
    }
  }

  public getSectionById(sectionId: string): { song: Song; section: Section } | undefined {
    for (const song of this.songs) {
      const section = song.sections.find(sec => sec.id === sectionId);
      if (section) {
        return { song, section };
      }
    }
    return undefined;
  }
}
