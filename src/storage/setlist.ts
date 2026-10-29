import fs from 'fs/promises';
import path from 'path';
import { dataDirectory, atomicJson, readJson } from './files.js';
import { StopBehavior } from '../types/index.js';

function getSetlistsDir(): string {
  return path.join(dataDirectory(), 'setlists');
}

export interface SavedSetlistFile {
  version: number;
  name: string;
  createdAt: string;
  order: string[];
  duplicates?: Record<string, string>;
  songOverrides?: Record<string, { color?: string; stopBehavior?: StopBehavior; duration?: number; isSkipped?: boolean }>;
}

export class SetlistStorage {
  constructor(private readonly directory = getSetlistsDir()) {

  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
  }

  public async listFiles(): Promise<string[]> {
    await this.ensureDir();
    try {
      const files = await fs.readdir(this.directory);
      return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    } catch (err) {
      console.error('[SetlistStorage] Error listing setlists:', err);
      return [];
    }
  }

  public async save(name: string, order: string[], overrides?: SavedSetlistFile['songOverrides'], duplicates?: Record<string, string>): Promise<void> {
    await this.ensureDir();
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(this.directory, `${safeName}.json`);

    const fileContent: SavedSetlistFile = {
      version: 2,
      name,
      createdAt: new Date().toISOString(),
      order,
      songOverrides: overrides,
      duplicates,
    };

    await atomicJson(filePath, fileContent);
  }

  public async delete(name: string): Promise<boolean> {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
      await fs.unlink(path.join(this.directory, `${safeName}.json`));
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw err;
    }
  }

  public async load(name: string): Promise<SavedSetlistFile | null> {
    await this.ensureDir();
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(this.directory, `${safeName}.json`);
    const data = await readJson(filePath);
    if (data === undefined) return null;
    if (!validSetlist(data)) throw new Error('Invalid saved setlist. Original file retained.');
    return data;
  }
}

export function validSetlist(value: unknown): value is SavedSetlistFile {
  const v = value as SavedSetlistFile;
  return !!v && [1, 2].includes(v.version) && typeof v.name === 'string'
    && Array.isArray(v.order) && v.order.every(id => typeof id === 'string')
    && (!v.duplicates || Object.values(v.duplicates).every(id => typeof id === 'string'))
    && (!v.songOverrides || Object.values(v.songOverrides).every(o => o && typeof o === 'object'
      && (o.duration === undefined || (Number.isFinite(o.duration) && o.duration > 0))
      && (o.stopBehavior === undefined || ['default', 'auto-jump', 'stop', 'pause'].includes(o.stopBehavior))));
}
