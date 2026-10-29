import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { StopBehavior } from '../types/index.js';

function getSetlistsDir(): string {
  return path.join(os.homedir(), '.ableset', 'setlists');
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
    this.ensureDir();
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.directory, { recursive: true });
    } catch (err) {
      console.error('[SetlistStorage] Failed to create setlists dir:', err);
    }
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

    await fs.writeFile(filePath, JSON.stringify(fileContent, null, 2), 'utf-8');
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
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as SavedSetlistFile;
    } catch (err) {
      console.error(`[SetlistStorage] Failed to load setlist ${name}:`, err);
      return null;
    }
  }
}
