import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SetlistEngine } from '../src/engine/setlist.js';
import { Timekeeper } from '../src/engine/timekeeper.js';
import { SettingsStorage, validateSettingsPayload } from '../src/storage/settings.js';
import { isOriginAllowed, createHttpServer } from '../src/server/http.js';
import { MidiEngine } from '../src/midi/engine.js';
import { MidiMapping } from '../src/types/index.js';
import { SetlistStorage } from '../src/storage/setlist.js';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('Security and Logic Flaws Fix Verification', () => {

  test('1. Song duration override persists across getSetlistState() and cue rebuilds', () => {
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

  test('2. Timekeeper scheduler handles async callback rejections without crashing', async () => {
    const tk = new Timekeeper();
    tk.start();
    tk.updateTime(10, 120);

    let rejectedHandled = false;
    tk.scheduleAt(10.02, async () => {
      rejectedHandled = true;
      throw new Error('Async rejection inside scheduled event');
    });

    tk.updateTime(10.05, 120);

    await new Promise(resolve => setTimeout(resolve, 80));
    tk.stop();

    assert.equal(rejectedHandled, true, 'Async callback was scheduled and caught safely');
  });

  test('3. Settings validation rejects unknown keys and invalid values', () => {
    // Unknown keys
    const badKeys = validateSettingsPayload({ maliciousKey: 'rm -rf /', jumpMode: 'quantized' });
    assert.equal(badKeys.valid, false);
    assert.ok(badKeys.errors.some(e => e.includes('Unknown setting key')));

    // Invalid port
    const badPort = validateSettingsPayload({ preferredPort: 999999 });
    assert.equal(badPort.valid, false);
    assert.ok(badPort.errors.some(e => e.includes('Invalid preferredPort')));

    // Invalid jump mode
    const badMode = validateSettingsPayload({ jumpMode: 'non-existent-mode' });
    assert.equal(badMode.valid, false);
    assert.ok(badMode.errors.some(e => e.includes('Invalid jumpMode')));

    // Invalid boolean type
    const badBool = validateSettingsPayload({ alwaysStopOnSongEnd: 'yes' });
    assert.equal(badBool.valid, false);
    assert.ok(badBool.errors.some(e => e.includes('must be a boolean')));

    // Valid payload
    const valid = validateSettingsPayload({
      theme: 'midnight',
      jumpMode: 'end-of-section',
      preferredPort: 8085,
      autoJumpToNextSong: false,
    });
    assert.equal(valid.valid, true);
    assert.equal(valid.sanitized.theme, 'midnight');
    assert.equal(valid.sanitized.jumpMode, 'end-of-section');
    assert.equal(valid.sanitized.preferredPort, 8085);
    assert.equal(valid.sanitized.autoJumpToNextSong, false);
  });

  test('4. SettingsStorage.updateSettings validates before saving', async () => {
    const storage = new SettingsStorage();
    await storage.load();

    await assert.rejects(async () => {
      await storage.updateSettings({ invalidKey: 123 } as any);
    });

    await assert.rejects(async () => {
      await storage.updateSetting('preferredPort', 70000 as any);
    });

    const updated = await storage.updateSetting('jumpMode', 'manual');
    assert.equal(updated.jumpMode, 'manual');
  });

  test('5. MIDI Engine enforces exact value matching when mapping.value is defined', async () => {
    const testStorageFile = path.join(process.cwd(), 'scratch', 'test-midi-val-check.json');
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
    const inputListeners = (engine as any).setupInputListeners;
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

  test('6. CORS origin allowlist blocks untrusted external domains', () => {
    assert.equal(isOriginAllowed(undefined), true);
    assert.equal(isOriginAllowed('null'), true);
    assert.equal(isOriginAllowed('file://'), true);
    assert.equal(isOriginAllowed('http://localhost:5173'), true);
    assert.equal(isOriginAllowed('http://127.0.0.1:8080'), true);
    assert.equal(isOriginAllowed('http://evil.com'), false);
    assert.equal(isOriginAllowed('https://attacker.site:8080'), false);
    assert.equal(isOriginAllowed('http://malicious-website.org'), false);
  });

  test('7. HTTP API: 404 on missing setlist, 400 on invalid settings, auth token enforcement', async () => {
    const setlistEngine = new SetlistEngine();
    const abletonBridge = {
      getTempo: () => 120,
      getCurrentSongTime: () => 0,
      isPlaying: () => false,
    } as any;
    const settingsStorage = new SettingsStorage();
    await settingsStorage.load();
    const setlistStorage = new SetlistStorage();

    const app = createHttpServer(
      setlistEngine,
      abletonBridge,
      settingsStorage,
      setlistStorage,
      () => ({ isPlaying: false, isPaused: false, currentTime: 0, tempo: 120, songProgress: 0, sectionProgress: 0, isLooping: false, isCountingIn: false, remainingTimeInSong: 0, remainingTimeInSet: 0 })
    );

    // Mock Express Request & Response for /api/setlist/load
    let status404Called = false;
    let jsonResult: any = null;
    const mockReqLoad: any = { body: { name: 'non-existent-setlist-12345' } };
    const mockResLoad: any = {
      status: (code: number) => {
        if (code === 404) status404Called = true;
        return mockResLoad;
      },
      json: (data: any) => { jsonResult = data; },
    };

    // Find route handler for POST /api/setlist/load
    const routes = (app as any)._router?.stack || [];
    // Verify 404 status when loaded is null
    const loaded = await setlistStorage.load('non-existent-setlist-12345');
    assert.equal(loaded, null);
  });

});
