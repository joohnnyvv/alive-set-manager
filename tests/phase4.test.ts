import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SetlistEngine } from '../src/engine/setlist.js';
import { SetlistStorage } from '../src/storage/setlist.js';

describe('Phase 4 — Setlist Editor & Persistence', () => {

  test('1. Song Reordering', () => {
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

  test('2. Soft Remove and Restore Songs', () => {
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

  test('3. Song Detail Overrides (color, stop behavior, duration)', () => {
    const engine = new SetlistEngine();
    const cues = [{ id: 's1', name: 'Song 1', time: 0 }];
    engine.buildSetlistFromCues(cues, 120);

    engine.updateSongOverride('s1', { color: 'blue', stopBehavior: 'stop', duration: 180 });
    const song = engine.getSongById('s1');

    assert.equal(song?.color, 'blue');
    assert.equal(song?.stopBehavior, 'stop');
    assert.equal(song?.duration, 180);
  });

  test('4. Setlist Storage Save and Load', async () => {
    const storage = new SetlistStorage();
    const testName = 'Test-Tour-Set';
    const order = ['s2', 's1', 's3'];

    await storage.save(testName, order);

    const loaded = await storage.load(testName);
    assert.notEqual(loaded, null);
    assert.equal(loaded?.name, testName);
    assert.deepEqual(loaded?.order, order);

    // Clean up test file
    const filePath = path.join(process.cwd(), 'setlists', `${testName}.json`);
    try {
      await fs.unlink(filePath);
    } catch (err) {}
  });

  test('5. Plain Text Setlist Import', () => {
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

  test('6. Song Duplication and Removal of Duplicates', () => {
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

});
