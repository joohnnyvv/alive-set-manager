import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import type { ScriptStatus } from './contracts.js';

async function fingerprint(directory: string): Promise<string> {
  const hash = createHash('sha256');
  async function visit(relative: string) {
    for (const entry of (await fs.readdir(path.join(directory, relative), { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      if (entry.name === '__pycache__' || entry.name.endsWith('.pyc')) continue;
      if (entry.isSymbolicLink()) throw new Error('Symbolic links in Remote Scripts are not supported. Choose another library.');
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) await visit(name);
      else { hash.update(name.split(path.sep).join('/')); hash.update(await fs.readFile(path.join(directory, name))); }
    }
  }
  await visit('');
  return hash.digest('hex');
}

async function assertNoSymlinks(target: string, boundary: string) {
  let current = path.resolve(target);
  while (true) {
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Choose the real library folder, not a symbolic link.'); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    if (current === path.resolve(boundary)) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

export async function scriptStatus(source: string, library: string): Promise<ScriptStatus> {
  if (!path.isAbsolute(library)) throw new Error('Choose an absolute User Library path.');
  const destination = path.join(library, 'Remote Scripts', 'AbletonJS');
  await assertNoSymlinks(destination, library);
  const version = async (dir: string) => (await fs.readFile(path.join(dir, 'version.py'), 'utf8')).match(/version\s*=\s*["']([^"']+)/)?.[1];
  const bundledVersion = await version(source);
  if (!bundledVersion) throw new Error('Bundled script is incomplete. Reinstall Alive Set Manager.');
  let installedVersion: string | undefined;
  try { await fs.access(destination); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    return { library, destination, bundledVersion, state: 'missing' };
  }
  try { installedVersion = await version(destination); } catch { /* custom script */ }
  return { library, destination, bundledVersion, installedVersion,
    state: await fingerprint(source) === await fingerprint(destination) ? 'current' : 'different' };
}

export async function installScript(source: string, library: string, allowReplacement = false): Promise<ScriptStatus> {
  const status = await scriptStatus(source, library);
  if (status.state === 'current') return status;
  if (status.state === 'different' && !allowReplacement) throw new Error('Existing script requires confirmation before replacement.');
  const parent = path.dirname(status.destination);
  await fs.mkdir(parent, { recursive: true });
  const staged = path.join(parent, `.alive-stage-${randomUUID()}`);
  // Backups stay outside Remote Scripts so Live does not load duplicate surfaces.
  const backup = path.join(library, 'Alive Set Manager Backups', `AbletonJS-${Date.now()}-${randomUUID()}`);
  let moved = false;
  try {
    await fs.cp(source, staged, { recursive: true, errorOnExist: true, force: false });
    if (await fingerprint(source) !== await fingerprint(staged)) throw new Error('Script copy verification failed.');
    if (status.state === 'different') {
      await fs.mkdir(path.dirname(backup), { recursive: true });
      await fs.rename(status.destination, backup); moved = true;
    }
    try { await fs.rename(staged, status.destination); }
    catch (error) { if (moved) await fs.rename(backup, status.destination); throw error; }
    return await scriptStatus(source, library);
  } finally { await fs.rm(staged, { recursive: true, force: true }); }
}
