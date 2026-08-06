import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SetlistEngine } from '../src/engine/setlist.js';

describe('Duplicate Song State Tracking', () => {

  test('getActiveSongAndSection preserves active duplicate song instance', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 's1', name: 'Song Alpha', time: 0 },
      { id: 's2', name: 'Song Beta', time: 32 },
    ];
    engine.buildSetlistFromCues(cues, 120);

    // Duplicate Song Alpha
    const dup = engine.duplicateSong('s1');
    assert.ok(dup);
    const dupId = dup.id;

    // Setlist order is now ['s1', dupId, 's2']
    const state1 = engine.getSetlistState();
    assert.deepEqual(state1.order, ['s1', dupId, 's2']);

    // Set active song to duplicate instance
    engine.setActiveSongId(dupId);

    // Playhead is at beat 10 (which falls into both s1 and dupId bounds)
    const active = engine.getActiveSongAndSection(10);
    assert.equal(active.song?.id, dupId, 'Should keep duplicate song instance active');

    const state2 = engine.getSetlistState(120, 10, true);
    assert.equal(state2.activeSongId, dupId, 'State should broadcast duplicate song ID as activeSongId');
  });

  test('getActiveSongAndSection advances naturally to next song in order when timeline moves', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 's1', name: 'Song Alpha', time: 0 },
      { id: 's2', name: 'Song Beta', time: 32 },
    ];
    engine.buildSetlistFromCues(cues, 120);

    const dup = engine.duplicateSong('s1');
    assert.ok(dup);
    const dupId = dup.id;

    // Active song is original s1 (time 0..32)
    engine.setActiveSongId('s1');
    assert.equal(engine.getActiveSongAndSection(5).song?.id, 's1');

    // Active song is dupId (time 0..32)
    engine.setActiveSongId(dupId);
    assert.equal(engine.getActiveSongAndSection(10).song?.id, dupId);

    // Timeline advances past 32 to beat 40 (Song Beta)
    const activeBeta = engine.getActiveSongAndSection(40);
    assert.equal(activeBeta.song?.id, 's2');
  });

});
