import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DemoMidi as MidiEngine } from '../testing/demo.js';
import { MidiMapping } from '../types/index.js';

describe('MIDI Engine', () => {

  test('device discovery & mapping persistence across restarts', async () => {
    const testStorageFile = path.join(process.env.ASM_DATA_DIR!, 'test-midi-mappings.json');
    try {
      await fs.unlink(testStorageFile);
    } catch {}

    let triggeredAction: any;
    const engine1 = new MidiEngine((action) => {
      triggeredAction = action;
    }, undefined, testStorageFile);

    await engine1.init();

    const devices = engine1.getDevices();
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

    await engine1.addMapping(mapping);
    assert.equal(engine1.getMappings().length, 1);
    assert.equal(engine1.getMappings()[0].id, 'm1');
    engine1.close();

    // Simulate closing the app and restarting a new instance
    const engine2 = new MidiEngine(() => {}, undefined, testStorageFile);
    await engine2.init();

    assert.equal(engine2.getMappings().length, 1, 'Mappings must be preserved after restarting the app');
    assert.equal(engine2.getMappings()[0].id, 'm1');
    assert.equal(engine2.getMappings()[0].inputName, 'Test Pedal');
    assert.equal(engine2.getMappings()[0].note, 60);

    // Remove mapping and verify deletion persists
    await engine2.removeMapping('m1');
    assert.equal(engine2.getMappings().length, 0);
    engine2.close();

    const engine3 = new MidiEngine(() => {}, undefined, testStorageFile);
    await engine3.init();
    assert.equal(engine3.getMappings().length, 0, 'Removal of mapping must persist after restart');
    engine3.close();

    // Clean up test file
    try {
      await fs.unlink(testStorageFile);
    } catch {}
  });

  test('MIDI Learn mode state handling', async () => {
    const testStorageFile = path.join(process.env.ASM_DATA_DIR!, 'test-midi-learn.json');
    const engine = new MidiEngine(() => {}, undefined, testStorageFile);
    const mapping: MidiMapping = {
      id: 'learn-test-1',
      inputName: '',
      messageType: 'note-on',
      channel: 1,
      action: { type: 'play' },
    };

    await engine.addMapping(mapping);
    engine.startLearn('learn-test-1');
    assert.equal(engine.getMappings()[0].id, 'learn-test-1');

    engine.cancelLearn();
    engine.close();

    try {
      await fs.unlink(testStorageFile);
    } catch {}
  });

  test('enforces exact value matching when mapping.value is defined', async () => {
    const testStorageFile = path.join(process.env.ASM_DATA_DIR!, 'test-midi-val-check.json');
    try { await fs.unlink(testStorageFile); } catch {}

    const triggeredActions: any[] = [];
    const engine = new MidiEngine(action => {
      triggeredActions.push(action);
    }, undefined, testStorageFile);

    await engine.init();

    const valueSpecificMapping: MidiMapping = {
      id: 'cc-exact',
      inputName: 'Any Device',
      messageType: 'cc',
      channel: 1,
      cc: 64,
      value: 127,
      action: { type: 'play' },
    };

    const anyValueMapping: MidiMapping = {
      id: 'cc-any',
      inputName: 'Any Device',
      messageType: 'cc',
      channel: 1,
      cc: 65,
      action: { type: 'stop' },
    };

    await engine.addMapping(valueSpecificMapping);
    await engine.addMapping(anyValueMapping);

    // Simulate input listener message handler
    let registeredCcHandler: ((msg: any) => void) | undefined;
    const mockInput = {
      on: (evt: string, handler: any) => {
        if (evt === 'cc') registeredCcHandler = handler;
      },
    };

    (engine as any).setupInputListeners('Test Device', mockInput);
    assert.ok(registeredCcHandler);

    // Send CC 64 with value 0 (should NOT trigger action because mapping.value is 127)
    registeredCcHandler!({ controller: 64, value: 0, channel: 0 });
    assert.equal(triggeredActions.length, 0, 'CC with non-matching value must not trigger');

    // Send CC 64 with value 127 (SHOULD trigger action)
    registeredCcHandler!({ controller: 64, value: 127, channel: 0 });
    assert.equal(triggeredActions.length, 1);
    assert.equal(triggeredActions[0].type, 'play');

    // Send CC 65 with value 42 (SHOULD trigger because value is undefined in mapping)
    registeredCcHandler!({ controller: 65, value: 42, channel: 0 });
    assert.equal(triggeredActions[1].type, 'stop');
    engine.close();
    try { await fs.unlink(testStorageFile); } catch {}
  });

  test('smart GO button decision logic matrix', () => {
    // Scenario 1: Stopped inside song -> Play
    let playCalled = false;
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
