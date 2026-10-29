import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
}
const directory = await mkdtemp(path.join(tmpdir(), 'alive-tests-'));
try {
  const tests = (await Promise.all(['src', 'frontend/src'].map(files))).flat().filter(f => f.endsWith('.test.ts'));
  const child = spawn(process.execPath, ['--import', 'tsx', '--test', ...tests], {
    stdio: 'inherit', env: { ...process.env, ASM_DATA_DIR: directory, ASM_TEST: '1' },
  });
  process.exitCode = await new Promise(resolve => child.on('exit', code => resolve(code ?? 1)));
} finally { await rm(directory, { recursive: true, force: true }); }
