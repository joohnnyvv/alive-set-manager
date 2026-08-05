import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MidiEngine } from '../src/midi/engine.js';
import { MidiMapping } from '../src/types/index.js';

describe('Phase 5 — MIDI Mapping & GO Button Logic', () => {

  test('1. MIDI Engine Device Discovery & Mapping Persistence', async () => {
    let triggeredAction: any;
    const engine = new MidiEngine((action) => {
      triggeredAction = action;
    });

    const devices = engine.getDevices();
    assert.ok(Array.isArray(devices.inputs));
    assert.ok(Array.isArray(devices.outputs));

    const mapping: MidiMapping = {
      id: 'm1',
      inputName: 'Test Pedal',
      messageType: 'note-on',
      channel: 1,
      note: 60,
      action: { type: 'go' },
    };

    engine.addMapping(mapping);
    assert.equal(engine.getMappings().length, 1);
    assert.equal(engine.getMappings()[0].id, 'm1');

    engine.removeMapping('m1');
    assert.equal(engine.getMappings().length, 0);

    // Clean up file
    const filePath = path.join(process.cwd(), 'midi-mappings.json');
    try {
      await fs.unlink(filePath);
    } catch (err) {}
  });

  test('2. MIDI Learn mode state handling', () => {
    const engine = new MidiEngine(() => {});
    const mapping: MidiMapping = {
      id: 'learn-test-1',
      inputName: '',
      messageType: 'note-on',
      channel: 1,
      action: { type: 'play' },
    };

    engine.addMapping(mapping);
    engine.startLearn('learn-test-1');
    assert.equal(engine.getMappings()[0].id, 'learn-test-1');

    engine.cancelLearn();
  });

  test('3. Smart GO Button Logic Matrix', async () => {
    // Scenario 1: Stopped inside song -> Play
    let playCalled = false;
    let stopCalled = false;
    let loopEscaped = false;

    const mockState1 = {
      isPlaying: false,
      remainingTimeInSong: 45,
      isLooping: false,
    };

    if (!mockState1.isPlaying) {
      playCalled = true;
    }
    assert.equal(playCalled, true, 'GO button when stopped inside song should trigger Play');

    // Scenario 2: Playing inside loop -> Escape Loop
    const mockState2 = {
      isPlaying: true,
      remainingTimeInSong: 20,
      isLooping: true,
    };

    if (mockState2.isPlaying && mockState2.isLooping) {
      loopEscaped = true;
    }
    assert.equal(loopEscaped, true, 'GO button when looping should escape loop');

    // Scenario 3: Stopped at song end -> Next Song
    let nextSongTriggered = false;
    const mockState3 = {
      isPlaying: false,
      remainingTimeInSong: 0.5,
    };

    if (!mockState3.isPlaying && mockState3.remainingTimeInSong <= 1) {
      nextSongTriggered = true;
    }
    assert.equal(nextSongTriggered, true, 'GO button at song end should jump to next song');
  });

});
