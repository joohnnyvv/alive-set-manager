import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackTracker } from './playback.js';
import { SetlistEngine } from './setlist.js';

describe('Playback Tracker', () => {

  test('calculates song progress, section progress, and remaining time accurately', () => {
    let isPlayingVal = true;
    let currentTimeVal = 16;
    let tempoVal = 120;

    const mockBridge = {
      isPlaying: () => isPlayingVal,
      isLooping: () => false,
      getCurrentSongTime: () => currentTimeVal,
      getTempo: () => tempoVal,
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

    assert.equal(state.isPlaying, true);
    assert.equal(state.isPaused, false);
    assert.equal(state.songProgress, 0.5); // 16 beats out of 32
    assert.equal(state.remainingTimeInSong, 8); // (32 - 16) / 120 * 60 = 8 seconds
    assert.equal(state.activeSongId, 'c1');
    assert.equal(state.activeSectionId, 'c3');
  });

  test('emits onSongChanged and onSectionChanged callbacks on boundary crossings', () => {
    let currentTimeVal = 0;
    const mockBridge = {
      isPlaying: () => true,
      isLooping: () => false,
      getCurrentSongTime: () => currentTimeVal,
      getTempo: () => 120,
    } as any;

    const engine = new SetlistEngine();
    const cues = [
      { id: 's1', name: 'Song 1', time: 0 },
      { id: 'sec1', name: '> Verse', time: 0 },
      { id: 'sec2', name: '> Chorus', time: 16 },
      { id: 's2', name: 'Song 2', time: 32 },
    ];
    engine.buildSetlistFromCues(cues, 120);

    const songChanges: string[] = [];
    const sectionChanges: string[] = [];

    const tracker = new PlaybackTracker(
      mockBridge,
      engine,
      (songId) => songChanges.push(songId),
      (secId) => sectionChanges.push(secId)
    );

    // Initial tick at beat 0
    tracker.getPlaybackState();
    assert.deepEqual(songChanges, ['s1']);
    assert.deepEqual(sectionChanges, ['sec1']);

    // Advance to beat 20 (Chorus)
    currentTimeVal = 20;
    tracker.getPlaybackState();
    assert.deepEqual(sectionChanges, ['sec1', 'sec2']);

    // Advance to beat 35 (Song 2)
    currentTimeVal = 35;
    tracker.getPlaybackState();
    assert.deepEqual(songChanges, ['s1', 's2']);
  });

  test('detects paused state correctly when stopped but playhead > 0', () => {
    const mockBridge = {
      isPlaying: () => false,
      isLooping: () => false,
      getCurrentSongTime: () => 10,
      getTempo: () => 120,
    } as any;

    const engine = new SetlistEngine();
    const tracker = new PlaybackTracker(mockBridge, engine);
    const state = tracker.getPlaybackState();

    assert.equal(state.isPlaying, false);
    assert.equal(state.isPaused, true);
  });

});
