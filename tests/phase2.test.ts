import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseLocator } from '../src/parsers/locator.js';
import { SetlistEngine } from '../src/engine/setlist.js';
import { PlaybackTracker } from '../src/engine/playback.js';

describe('Phase 2 — Playback Control & State Tracking', () => {

  test('1. Locator Parser extracts song & section boundaries correctly', () => {
    const loc1 = parseLocator('Song Alpha {Tuning: E}', 0);
    assert.equal(loc1.type, 'song');
    assert.equal(loc1.name, 'Song Alpha');
    assert.equal(loc1.description, 'Tuning: E');

    const loc2 = parseLocator('> Intro +LOOP', 16);
    assert.equal(loc2.type, 'section');
    assert.equal(loc2.name, 'Intro');
    assert.equal(loc2.flags.loop, true);

    const loc3 = parseLocator('>> Chorus', 32);
    assert.equal(loc3.type, 'section');
    assert.equal(loc3.name, 'Chorus');
    assert.equal(loc3.flags.quickJump, true);
  });

  test('2. Setlist Engine builds songs, sections, and calculates durations accurately', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 'c1', name: 'First Song', time: 0 },
      { id: 'c2', name: '> Verse 1', time: 16 },
      { id: 'c3', name: '> Chorus', time: 32 },
      { id: 'c4', name: 'Second Song', time: 64 },
      { id: 'c5', name: '> Intro', time: 80 },
      { id: 'c6', name: 'SONG END', time: 128 },
    ];

    const setlist = engine.buildSetlistFromCues(cues, 120);

    assert.equal(setlist.songs.length, 2);
    assert.equal(setlist.songs[0].name, 'First Song');
    assert.equal(setlist.songs[0].startTime, 0);
    assert.equal(setlist.songs[0].endTime, 64);
    assert.equal(setlist.songs[0].sections.length, 2);

    assert.equal(setlist.songs[1].name, 'Second Song');
    assert.equal(setlist.songs[1].startTime, 64);
    assert.equal(setlist.songs[1].endTime, 128);
    assert.equal(setlist.songs[1].sections.length, 1);
  });

  test('3. Active song and section detection from current_song_time with tolerance', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 'c1', name: 'Song One', time: 0 },
      { id: 'c2', name: '> Intro', time: 0 },
      { id: 'c3', name: '> Chorus', time: 16 },
      { id: 'c4', name: 'Song Two', time: 32 },
    ];
    engine.buildSetlistFromCues(cues, 120);

    // At beat 5 -> Song One, Intro
    let active = engine.getActiveSongAndSection(5);
    assert.equal(active.song?.name, 'Song One');
    assert.equal(active.section?.name, 'Intro');

    // At beat 20 -> Song One, Chorus
    active = engine.getActiveSongAndSection(20);
    assert.equal(active.song?.name, 'Song One');
    assert.equal(active.section?.name, 'Chorus');

    // At beat 35 -> Song Two
    active = engine.getActiveSongAndSection(35);
    assert.equal(active.song?.name, 'Song Two');

    // Past last song -> undefined
    active = engine.getActiveSongAndSection(500);
    assert.equal(active.song, undefined);
  });

  test('4. Progress bar calculations (0.0 to 1.0 bounds and remaining time)', () => {
    const mockBridge = {
      isPlaying: () => true,
      getCurrentSongTime: () => 16,
      getTempo: () => 120,
    } as any;

    const engine = new SetlistEngine();
    const cues = [
      { id: 'c1', name: 'Track 1', time: 0 },
      { id: 'c2', name: '> Verse', time: 0 },
      { id: 'c3', name: '> Chorus', time: 16 },
      { id: 'c4', name: 'SONG END', time: 32 },
    ];
    engine.buildSetlistFromCues(cues, 120);

    const tracker = new PlaybackTracker(mockBridge, engine);
    const state = tracker.getPlaybackState();

    assert.equal(state.songProgress, 0.5); // 16 beats out of 32
    assert.equal(state.remainingTimeInSong, 8); // (32 - 16) / 120 * 60 = 8 seconds
  });

  test('5. Verify no raw startPlaying() or stopPlaying() calls exist in codebase', async () => {
    const srcDir = path.join(process.cwd(), 'src');
    const files = await getFilesRecursively(srcDir);

    for (const file of files) {
      if (!file.endsWith('.ts')) continue;
      const content = await fs.readFile(file, 'utf-8');

      // Ensure no raw startPlaying() or stopPlaying() without "safe" prefix
      const hasRawStart = /(?<!safe)startPlaying\(\)/.test(content);
      const hasRawStop = /(?<!safe)stopPlaying\(\)/.test(content);

      assert.equal(hasRawStart, false, `Raw startPlaying() found in ${file}`);
      assert.equal(hasRawStop, false, `Raw stopPlaying() found in ${file}`);
    }
  });

  test('6. Per-song target tempo tag (#140bpm) & tempo-aware duration calculation', () => {
    const loc1 = parseLocator('Upbeat Song #140bpm', 0);
    assert.equal(loc1.targetTempo, 140);

    const loc2 = parseLocator('Slow Ballad {bpm: 80}', 64);
    assert.equal(loc2.targetTempo, 80);

    const engine = new SetlistEngine();
    const cues = [
      { id: 'c1', name: 'Upbeat Song #140bpm', time: 0 },
      { id: 'c2', name: 'Slow Ballad {bpm: 80}', time: 140 },
      { id: 'c3', name: 'SONG END', time: 220 },
    ];

    const setlist = engine.buildSetlistFromCues(cues, 120);

    // Song 1: 140 beats at 140 BPM = 60 seconds
    assert.equal(Math.round(setlist.songs[0].duration), 60);

    // Song 2: 80 beats at 80 BPM = 60 seconds
    assert.equal(Math.round(setlist.songs[1].duration), 60);

    // Total Set Duration = 60s + 60s = 120 seconds
    assert.equal(Math.round(setlist.totalDuration), 120);
  });

});

async function getFilesRecursively(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await getFilesRecursively(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}
