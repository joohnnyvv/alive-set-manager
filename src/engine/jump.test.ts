import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JumpEngine } from './jump.js';
import { SetlistEngine } from './setlist.js';
import { Timekeeper } from './timekeeper.js';
import { SettingsStorage } from '../storage/settings.js';

describe('Jump Engine', () => {

  test('state machine transitions: IDLE -> QUEUED -> JUMPING -> IDLE', async () => {
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

  test('queue cancellation clears queued target correctly', async () => {
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

  test('does not start playback automatically when stopped', async () => {
    const setlistEngine = new SetlistEngine();
    const cues = [
      { id: 'c1', name: 'Song One', time: 0 },
      { id: 'c2', name: 'Song Two', time: 32 },
    ];
    setlistEngine.buildSetlistFromCues(cues, 120);

    let playing = false;
    let jumpedCueId = '';

    const mockBridge = {
      isPlaying: () => playing,
      getCurrentSongTime: () => 0,
      getTempo: () => 120,
      jumpToCue: async (id: string) => { jumpedCueId = id; },
      safePlay: async () => { playing = true; },
    } as any;

    const tk = new Timekeeper();
    const settings = new SettingsStorage();
    const jumpEngine = new JumpEngine(setlistEngine, mockBridge, tk, settings);

    await jumpEngine.requestSongJump('c2');
    assert.equal(jumpedCueId, 'c2');
    assert.equal(playing, false, 'Playback should remain stopped after jumping to a song when stopped');
  });

  test('quantized mode executes immediate jump without queueing', async () => {
    const setlistEngine = new SetlistEngine();
    const cues = [
      { id: 'c1', name: 'Song 1', time: 0 },
      { id: 'c2', name: 'Song 2', time: 32 },
    ];
    setlistEngine.buildSetlistFromCues(cues, 120);

    let jumpedId = '';
    const mockBridge = {
      isPlaying: () => true,
      getCurrentSongTime: () => 5,
      getTempo: () => 120,
      jumpToCue: async (id: string) => { jumpedId = id; },
    } as any;

    const tk = new Timekeeper();
    const settings = new SettingsStorage();
    await settings.updateSetting('jumpMode', 'quantized');

    const jumpEngine = new JumpEngine(setlistEngine, mockBridge, tk, settings);
    await jumpEngine.requestSongJump('c2');

    assert.equal(jumpedId, 'c2');
    assert.equal(jumpEngine.getQueuedTarget(), undefined);
  });

});
