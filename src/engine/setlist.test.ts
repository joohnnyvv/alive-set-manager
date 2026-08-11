import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SetlistEngine } from './setlist.js';

describe('Setlist Engine', () => {

  test('builds songs, sections, and calculates durations accurately', () => {
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

  test('supports per-song target tempo tag (#140bpm) and tempo-aware duration calculation', () => {
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

  test('detects active song and section from playhead time with tolerance', () => {
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

  test('builds sections with chord progressions attached and supports dynamic updates', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 'c1', name: 'Song Alpha', time: 0 },
      { id: 'c2', name: '> Verse {c: C G Am F}', time: 16 },
      { id: 'c3', name: '> Chorus {chords: F G C}', time: 32 },
    ];

    const state = engine.buildSetlistFromCues(cues);
    assert.equal(state.songs.length, 1);
    const song = state.songs[0];
    assert.equal(song.sections.length, 2);
    assert.equal(song.sections[0].name, 'Verse');
    assert.equal(song.sections[0].chords, 'C G Am F');
    assert.equal(song.sections[1].name, 'Chorus');
    assert.equal(song.sections[1].chords, 'F G C');

    // Dynamically update chords
    engine.updateSectionChords('c2', 'Em C G D');
    const sec = engine.getSectionById('c2');
    assert.ok(sec);
    assert.equal(sec.section.chords, 'Em C G D');
  });

  test('supports song reordering', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 's1', name: 'Alpha', time: 0 },
      { id: 's2', name: 'Beta', time: 32 },
      { id: 's3', name: 'Gamma', time: 64 },
    ];
    let state = engine.buildSetlistFromCues(cues, 120);

    assert.deepEqual(state.order, ['s1', 's2', 's3']);

    // Reorder: Gamma -> Alpha -> Beta
    engine.reorder(['s3', 's1', 's2']);
    state = engine.getSetlistState();

    assert.deepEqual(state.order, ['s3', 's1', 's2']);
    assert.equal(state.songs[0].id, 's3');
    assert.equal(state.songs[1].id, 's1');
  });

  test('supports soft remove and restore of songs', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 's1', name: 'Song 1', time: 0 },
      { id: 's2', name: 'Song 2', time: 32 },
    ];
    engine.buildSetlistFromCues(cues, 120);

    // Remove song 1
    engine.removeSong('s1');
    let state = engine.getSetlistState();
    assert.equal(state.songs.find(s => s.id === 's1')?.isSkipped, true);

    // Restore song 1
    engine.restoreSong('s1');
    state = engine.getSetlistState();
    assert.equal(state.songs.find(s => s.id === 's1')?.isSkipped, false);
  });

  test('supports song detail overrides (color, stop behavior, duration)', () => {
    const engine = new SetlistEngine();
    const cues = [{ id: 's1', name: 'Song 1', time: 0 }];
    engine.buildSetlistFromCues(cues, 120);

    engine.updateSongOverride('s1', { color: 'blue', stopBehavior: 'stop', duration: 180 });
    const song = engine.getSongById('s1');

    assert.equal(song?.color, 'blue');
    assert.equal(song?.stopBehavior, 'stop');
    assert.equal(song?.duration, 180);
  });

  test('persists song duration override across getSetlistState() and cue rebuilds', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 's1', name: 'Song One', time: 0 },
      { id: 's2', name: 'Song Two', time: 32 },
    ];
    engine.buildSetlistFromCues(cues, 120);

    // Default duration at 120 BPM for 32 beats = 16 seconds
    let state = engine.getSetlistState(120);
    assert.equal(state.songs[0].duration, 16);

    // Apply manual duration override
    engine.updateSongOverride('s1', { duration: 250 });

    // Recompute state with different tempo / time
    state = engine.getSetlistState(140, 10, true);
    assert.equal(state.songs[0].duration, 250, 'Duration override must persist across getSetlistState recomputation');
    assert.equal(state.songs[0].durationOverride, 250);

    // Rebuild from cues (e.g. Ableton cue points refreshed)
    state = engine.buildSetlistFromCues(cues, 120);
    assert.equal(state.songs[0].duration, 250, 'Duration override must persist after cue points reload');
    assert.equal(state.songs[0].durationOverride, 250);
  });

  test('supports plain text setlist import', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 's1', name: 'Intro Track', time: 0 },
      { id: 's2', name: 'Superstar', time: 32 },
      { id: 's3', name: 'Finale', time: 64 },
    ];
    engine.buildSetlistFromCues(cues, 120);

    const importText = `Superstar\nFinale\nIntro Track`;
    engine.importFromText(importText);

    const state = engine.getSetlistState();
    assert.deepEqual(state.order, ['s2', 's3', 's1']);
  });

  test('supports song duplication and removal of duplicates', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 's1', name: 'Hit Song', time: 0 },
      { id: 's2', name: 'Balad', time: 32 },
    ];
    engine.buildSetlistFromCues(cues, 120);

    // Duplicate 's1'
    const dup = engine.duplicateSong('s1');
    assert.ok(dup);
    assert.equal(dup.isDuplicate, true);
    assert.equal(dup.originalId, 's1');

    let state = engine.getSetlistState();
    assert.equal(state.order.length, 3);
    assert.equal(state.order[0], 's1');
    assert.equal(state.order[1], dup.id);
    assert.equal(state.order[2], 's2');

    // Remove duplicate song
    engine.removeSong(dup.id);
    state = engine.getSetlistState();
    assert.equal(state.order.length, 2);
    assert.deepEqual(state.order, ['s1', 's2']);
    assert.equal(engine.getSongById(dup.id), undefined);
  });

  test('preserves active duplicate song instance and advances naturally', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 's1', name: 'Song Alpha', time: 0 },
      { id: 's2', name: 'Song Beta', time: 32 },
    ];
    engine.buildSetlistFromCues(cues, 120);

    const dup = engine.duplicateSong('s1');
    assert.ok(dup);
    const dupId = dup.id;

    // Set active song to duplicate instance
    engine.setActiveSongId(dupId);

    // Playhead is at beat 10 (which falls into both s1 and dupId bounds)
    const active = engine.getActiveSongAndSection(10);
    assert.equal(active.song?.id, dupId, 'Should keep duplicate song instance active');

    const state2 = engine.getSetlistState(120, 10, true);
    assert.equal(state2.activeSongId, dupId, 'State should broadcast duplicate song ID as activeSongId');

    // Advance timeline past 32 to beat 40 (Song Beta)
    const activeBeta = engine.getActiveSongAndSection(40);
    assert.equal(activeBeta.song?.id, 's2');
  });

});
