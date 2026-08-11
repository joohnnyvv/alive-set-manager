import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SettingsStorage, validateSettingsPayload } from './settings.js';

describe('Settings Storage & Validation', () => {

  test('validates settings payload rejecting unknown keys and invalid values', () => {
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

  test('updateSettings validates before saving and throws on invalid payload', async () => {
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

  test('supports all 5 jump modes configuration', async () => {
    const modes = ['quantized', 'end-of-section', 'end-of-song', 'dynamic', 'manual'] as const;
    const settings = new SettingsStorage();

    for (const mode of modes) {
      await settings.updateSetting('jumpMode', mode);
      assert.equal(settings.getSettings().jumpMode, mode);
    }
  });

});
