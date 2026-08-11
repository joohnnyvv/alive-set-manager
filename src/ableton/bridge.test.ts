import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Ableton Bridge & Safety Wrappers', () => {

  test('verifies no raw startPlaying() or stopPlaying() calls exist in codebase', async () => {
    const srcDir = path.join(process.cwd(), 'src');
    const files = await getFilesRecursively(srcDir);

    for (const file of files) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts') || file.endsWith('bridge.ts')) continue;
      const content = await fs.readFile(file, 'utf-8');

      // Ensure no raw startPlaying() or stopPlaying() without "safe" prefix
      const hasRawStart = /(?<!safe)startPlaying\(\)/.test(content);
      const hasRawStop = /(?<!safe)stopPlaying\(\)/.test(content);

      assert.equal(hasRawStart, false, `Raw startPlaying() found in ${file}`);
      assert.equal(hasRawStop, false, `Raw stopPlaying() found in ${file}`);
    }
  });

});

async function getFilesRecursively(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await getFilesRecursively(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}
