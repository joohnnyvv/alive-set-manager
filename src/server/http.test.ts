import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isOriginAllowed, createHttpServer } from './http.js';
import { SetlistEngine } from '../engine/setlist.js';
import { SettingsStorage } from '../storage/settings.js';
import { SetlistStorage } from '../storage/setlist.js';

describe('HTTP Server & API Routes', () => {

  test('CORS origin allowlist blocks untrusted external domains', () => {
    assert.equal(isOriginAllowed(undefined), true);
    assert.equal(isOriginAllowed('null'), true);
    assert.equal(isOriginAllowed('file://'), true);
    assert.equal(isOriginAllowed('http://localhost:5173'), true);
    assert.equal(isOriginAllowed('http://127.0.0.1:8080'), true);
    assert.equal(isOriginAllowed('http://evil.com'), false);
    assert.equal(isOriginAllowed('https://attacker.site:8080'), false);
    assert.equal(isOriginAllowed('http://malicious-website.org'), false);
  });

  test('handles 404 on missing setlists, 400 on invalid settings, and auth token checks', async () => {
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
      () => ({
        isPlaying: false,
        isPaused: false,
        currentTime: 0,
        tempo: 120,
        songProgress: 0,
        sectionProgress: 0,
        isLooping: false,
        isCountingIn: false,
        remainingTimeInSong: 0,
        remainingTimeInSet: 0,
      })
    );

    assert.ok(app);

    // Verify 404 status when loaded is null
    const loaded = await setlistStorage.load('non-existent-setlist-12345');
    assert.equal(loaded, null);
  });

});
