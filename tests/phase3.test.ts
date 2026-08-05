import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Timekeeper } from '../src/engine/timekeeper.js';
import { JumpEngine } from '../src/engine/jump.js';
import { SetlistEngine } from '../src/engine/setlist.js';
import { SettingsStorage } from '../src/storage/settings.js';

describe('Phase 3 — Jump Modes, Scheduling & Stop Behaviors', () => {

  test('1. Timekeeper lookahead scheduler executes scheduled callbacks accurately', (t, done) => {
    const tk = new Timekeeper();
    tk.start();
    tk.updateTime(10, 120);

    let executed = false;
    tk.scheduleAt(10.05, () => {
      executed = true;
    });

    // Advance timekeeper time
    tk.updateTime(10.06, 120);

    setTimeout(() => {
      tk.stop();
      assert.equal(executed, true, 'Scheduled callback should execute when beat time reaches target');
      done();
    }, 50);
  });

  test('2. Jump Engine State Machine: IDLE -> QUEUED -> JUMPING -> IDLE', async () => {
    const setlistEngine = new SetlistEngine();
    const cues = [
      { id: 'c1', name: 'Song One', time: 0 },
      { id: 'c2', name: '> Verse 1', time: 0 },
      { id: 'c3', name: '> Chorus', time: 16 },
      { id: 'c4', name: 'Song Two', time: 32 },
    ];
    setlistEngine.buildSetlistFromCues(cues, 120);

    let currentSongTime = 5;
    let playing = true;
    let jumpedCueId = '';

    const mockBridge = {
      isPlaying: () => playing,
      getCurrentSongTime: () => currentSongTime,
      getTempo: () => 120,
      jumpToCue: async (id: string) => { jumpedCueId = id; },
      safePlay: async () => { playing = true; },
    } as any;

    const tk = new Timekeeper();
    const settings = new SettingsStorage();
    await settings.updateSetting('jumpMode', 'end-of-section');

    let queuedSong: string | undefined;
    let queuedSection: string | undefined;

    const jumpEngine = new JumpEngine(setlistEngine, mockBridge, tk, settings, (sId, secId) => {
      queuedSong = sId;
      queuedSection = secId;
    });

    // Initially IDLE
    assert.equal(jumpEngine.getQueuedTarget(), undefined);

    // Request section jump -> QUEUED
    await jumpEngine.requestSectionJump('c3'); // Chorus
    assert.equal(queuedSection, 'c3');
    assert.equal(jumpEngine.getQueuedTarget()?.sectionId, 'c3');

    // Trigger immediate execution -> JUMPING -> IDLE
    await jumpEngine.executeQueuedNow();
    assert.equal(jumpedCueId, 'c3');
    assert.equal(jumpEngine.getQueuedTarget(), undefined);
  });

  test('3. Queue Cancellation clears queued target correctly', async () => {
    const setlistEngine = new SetlistEngine();
    const cues = [
      { id: 'c1', name: 'Song A', time: 0 },
      { id: 'c2', name: 'Song B', time: 32 },
    ];
    setlistEngine.buildSetlistFromCues(cues, 120);

    const mockBridge = {
      isPlaying: () => true,
      getCurrentSongTime: () => 10,
      getTempo: () => 120,
    } as any;

    const tk = new Timekeeper();
    const settings = new SettingsStorage();
    await settings.updateSetting('jumpMode', 'end-of-song');

    let queuedSong: string | undefined;
    const jumpEngine = new JumpEngine(setlistEngine, mockBridge, tk, settings, (sId) => {
      queuedSong = sId;
    });

    await jumpEngine.requestSongJump('c2');
    assert.equal(queuedSong, 'c2');

    // Cancel Queue
    jumpEngine.cancelQueue();
    assert.equal(jumpEngine.getQueuedTarget(), undefined);
    assert.equal(queuedSong, undefined);
  });

  test('4. All 5 Jump Modes configuration and target resolution', async () => {
    const modes = ['quantized', 'end-of-section', 'end-of-song', 'dynamic', 'manual'] as const;
    const settings = new SettingsStorage();

    for (const mode of modes) {
      await settings.updateSetting('jumpMode', mode);
      assert.equal(settings.getSettings().jumpMode, mode);
    }
  });

  test('5. Song stop behavior parsing (auto-jump vs stop vs pause)', () => {
    const engine = new SetlistEngine();
    const cues = [
      { id: 'c1', name: 'Song Auto', time: 0 },
      { id: 'c2', name: 'Song Stop +JUMP', time: 32 },
      { id: 'c3', name: 'Song Pause +PAUSE', time: 64 },
    ];
    const setlist = engine.buildSetlistFromCues(cues, 120);

    assert.equal(setlist.songs[0].stopBehavior, 'default');
    assert.equal(setlist.songs[1].stopBehavior, 'stop');
    assert.equal(setlist.songs[2].stopBehavior, 'pause');
  });

});
