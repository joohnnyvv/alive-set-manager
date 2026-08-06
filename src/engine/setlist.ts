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
          chords: loc.chords,
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

    // Preserve any duplicated songs from existing state whose original song still exists
    const duplicates = this.songs.filter(s => s.isDuplicate && songs.some(orig => orig.id === (s.originalId || s.id)));
    for (const dup of duplicates) {
      const orig = songs.find(s => s.id === (dup.originalId || dup.id));
      if (orig) {
        dup.startTime = orig.startTime;
        dup.endTime = orig.endTime;
        dup.duration = orig.duration;
        dup.targetTempo = orig.targetTempo;
        dup.color = dup.color || orig.color;
        dup.tags = orig.tags;
        dup.sections = orig.sections.map((sec, idx) => ({
          ...sec,
          id: `${sec.originalId || sec.id}_dup_${dup.id}_${idx}`,
          originalId: sec.originalId || sec.id,
        }));
      }
    }

    const allSongs = [...songs, ...duplicates];
    this.songs = allSongs;

    const validIds = new Set(allSongs.map(s => s.id));
    const updatedOrder = this.order.filter(id => validIds.has(id));
    for (const s of allSongs) {
      if (!updatedOrder.includes(s.id)) {
        updatedOrder.push(s.id);
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

  public setActiveSongId(songId?: string): void {
    if (songId) {
      const exists = this.songs.some(s => s.id === songId);
      if (exists) {
        this.activeSongId = songId;
      }
    }
  }

  public getActiveSongAndSection(currentTime: number): { song?: Song; section?: Section } {
    const songMap = new Map(this.songs.map(s => [s.id, s]));
    const orderedSongs = this.order.map(id => songMap.get(id)).filter((s): s is Song => s !== undefined);

    let activeSong: Song | undefined = undefined;

    // 1. Check if currently active song ID is still valid for currentTime
    if (this.activeSongId) {
      const currentActive = songMap.get(this.activeSongId);
      if (currentActive && !currentActive.isSkipped) {
        if (currentTime >= currentActive.startTime - 0.01 && currentTime < currentActive.endTime - 0.01) {
          activeSong = currentActive;
        } else if (currentTime >= currentActive.endTime - 0.05 && currentTime <= currentActive.endTime + 0.5) {
          activeSong = currentActive;
        }
      }
    }

    // 2. If playhead left current active song, check subsequent songs in setlist order
    if (!activeSong && this.activeSongId) {
      const currentIdx = this.order.indexOf(this.activeSongId);
      if (currentIdx !== -1) {
        for (let i = currentIdx + 1; i < this.order.length; i++) {
          const nextSong = songMap.get(this.order[i]);
          if (nextSong && !nextSong.isSkipped) {
            if (currentTime >= nextSong.startTime - 0.01 && currentTime < nextSong.endTime - 0.01) {
              activeSong = nextSong;
              this.activeSongId = nextSong.id;
              break;
            }
          }
        }
      }
    }

    // 3. Fallback: Find first non-skipped song in setlist order matching currentTime
    if (!activeSong) {
      activeSong = orderedSongs.find(s => !s.isSkipped && currentTime >= s.startTime - 0.01 && currentTime < s.endTime - 0.01);
      if (!activeSong && orderedSongs.length > 0) {
        const lastSong = [...orderedSongs].filter(s => !s.isSkipped).sort((a, b) => b.endTime - a.endTime)[0];
        if (lastSong && currentTime >= lastSong.endTime - 0.05 && currentTime <= lastSong.endTime + 0.5) {
          activeSong = lastSong;
        }
      }
      if (activeSong) {
        this.activeSongId = activeSong.id;
      }
    }

    if (!activeSong) {
      return { song: undefined, section: undefined };
    }

    // Find section inside activeSong matching currentTime
    let section = activeSong.sections.find(sec => currentTime >= sec.startTime - 0.01 && currentTime < sec.endTime - 0.01);
    if (!section && activeSong.sections.length > 0) {
      const lastSection = [...activeSong.sections].sort((a, b) => b.endTime - a.endTime)[0];
      if (lastSection && currentTime >= lastSection.endTime - 0.05 && currentTime <= lastSection.endTime + 0.5) {
        section = lastSection;
      }
    }
    return { song: activeSong, section };
  }

  public reorder(newOrder: string[]): void {
    // Filter to only valid song IDs
    const validIds = new Set(this.songs.map(s => s.id));
    this.order = newOrder.filter(id => validIds.has(id));
  }

  public removeSong(songId: string): void {
    const song = this.songs.find(s => s.id === songId);
    if (song) {
      if (song.isDuplicate) {
        this.deleteSong(songId);
      } else {
        song.isSkipped = true;
      }
    }
  }

  public deleteSong(songId: string): void {
    this.order = this.order.filter(id => id !== songId);
    const songIndex = this.songs.findIndex(s => s.id === songId);
    if (songIndex !== -1 && this.songs[songIndex].isDuplicate) {
      this.songs.splice(songIndex, 1);
    }
  }

  public duplicateSong(songId: string): Song | undefined {
    const originalSong = this.songs.find(s => s.id === songId);
    if (!originalSong) return undefined;

    const baseId = originalSong.originalId || originalSong.id;
    const dupIndex = Date.now() + Math.floor(Math.random() * 1000);
    const newId = `${baseId}_dup_${dupIndex}`;

    const dupSong: Song = {
      ...originalSong,
      id: newId,
      originalId: baseId,
      isDuplicate: true,
      isSkipped: false,
      sections: originalSong.sections.map((sec, idx) => ({
        ...sec,
        id: `${sec.originalId || sec.id}_dup_${dupIndex}_${idx}`,
        originalId: sec.originalId || sec.id,
      })),
    };

    this.songs.push(dupSong);

    const orderIdx = this.order.indexOf(songId);
    if (orderIdx !== -1) {
      this.order.splice(orderIdx + 1, 0, newId);
    } else {
      this.order.push(newId);
    }

    return dupSong;
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

  public updateSectionChords(sectionId: string, chords: string): void {
    const res = this.getSectionById(sectionId);
    if (res) {
      res.section.chords = chords.trim() || undefined;
    }
  }
}
