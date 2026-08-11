import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SetlistStorage } from './setlist.js';

describe('Setlist Storage', () => {

  test('saves and loads setlist files accurately', async () => {
    const storage = new SetlistStorage();
    const testName = 'Test-Tour-Set-' + Date.now();
    const order = ['s2', 's1', 's3'];
    const overrides = { s1: { color: 'blue' } };

    await storage.save(testName, order, overrides);

    const loaded = await storage.load(testName);
    assert.notEqual(loaded, null);
    assert.equal(loaded?.name, testName);
    assert.deepEqual(loaded?.order, order);
    assert.deepEqual(loaded?.songOverrides, overrides);

    // Clean up test file
    const filePath = path.join(os.homedir(), '.ableset', 'setlists', `${testName}.json`);
    try {
      await fs.unlink(filePath);
    } catch {}
  });

  test('returns null when loading non-existent setlist file', async () => {
    const storage = new SetlistStorage();
    const loaded = await storage.load('non-existent-setlist-9999999');
    assert.equal(loaded, null);
  });

  test('lists saved setlist files', async () => {
    const storage = new SetlistStorage();
    const testName = 'Test-List-' + Date.now();
    await storage.save(testName, ['s1']);

    const files = await storage.listFiles();
    assert.ok(Array.isArray(files));
    assert.ok(files.includes(testName));

    // Clean up
    const filePath = path.join(os.homedir(), '.ableset', 'setlists', `${testName}.json`);
    try {
      await fs.unlink(filePath);
    } catch {}
  });

});
