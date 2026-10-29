import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { atomicJson, readJson } from './files.js';
import { validateSettingsPayload } from './settings.js';
import { validSetlist } from './setlist.js';

export async function migrateLegacy(destination: string, source = path.join(os.homedir(), '.ableset')) {
  const marker = path.join(destination, 'migration-v1.json');
  if (await readJson(marker)) return;
  const warnings: string[] = [];
  const copy = async (relative: string, valid: (value: any) => boolean) => {
    const target = path.join(destination, relative);
    try {
      try { await fs.access(target); return; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
      const value = await readJson(path.join(source, relative));
      if (value === undefined) return;
      if (!valid(value)) throw new Error('Invalid legacy data');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
    } catch { warnings.push(relative); }
  };
  await copy('settings.json', v => validateSettingsPayload(v).valid);
  await copy('midi-mappings.json', v => Array.isArray(v) && v.every(m => m && typeof m.id === 'string' && typeof m.action?.type === 'string'));
  let names: string[] = [];
  try { names = await fs.readdir(path.join(source, 'setlists')); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') warnings.push('setlists'); }
  for (const name of names.filter(n => n.endsWith('.json'))) await copy(path.join('setlists', name), validSetlist);
  await atomicJson(marker, { completedAt: new Date().toISOString(), warnings });
  return warnings;
}
