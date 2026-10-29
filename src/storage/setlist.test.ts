import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SetlistStorage } from './setlist.js';

describe('Setlist Storage', () => {
  let directory: string;
  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-setlists-'));
  });
  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });


  test('saves and loads setlist files accurately', async () => {
    const storage = new SetlistStorage(directory);
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
    const filePath = path.join(directory, `${testName}.json`);
    try {
      await fs.unlink(filePath);
    } catch {}
  });

  test('deletes only the selected saved file and reports missing files', async () => {
    const storage = new SetlistStorage(directory);
    await storage.save('Delete me', ['s1']);
    await storage.save('Keep', ['s2']);
    assert.equal(await storage.delete('Delete_me'), true);
    assert.deepEqual(await storage.listFiles(), ['Keep']);
    assert.equal(await storage.delete('Delete_me'), false);
    assert.deepEqual((await storage.load('Keep'))?.order, ['s2']);
  });

  test('reports deletion errors instead of claiming success', async () => {
    const storage = new SetlistStorage(directory);
    await fs.mkdir(path.join(directory, 'NotAFile.json'));
    await assert.rejects(storage.delete('NotAFile'));
  });

  test('returns null when loading non-existent setlist file', async () => {
    const storage = new SetlistStorage(directory);
    const loaded = await storage.load('non-existent-setlist-9999999');
    assert.equal(loaded, null);
  });

  test('lists saved setlist files', async () => {
    const storage = new SetlistStorage(directory);
    const testName = 'Test-List-' + Date.now();
    await storage.save(testName, ['s1']);

    const files = await storage.listFiles();
    assert.ok(Array.isArray(files));
    assert.ok(files.includes(testName));

    // Clean up
    const filePath = path.join(directory, `${testName}.json`);
    try {
      await fs.unlink(filePath);
    } catch {}
  });

});
