import fs from 'fs/promises';
import path from 'path';

const SETLISTS_DIR = path.join(process.cwd(), 'setlists');

export interface SavedSetlistFile {
  version: number;
  name: string;
  createdAt: string;
  order: string[];
  songOverrides?: Record<string, { color?: string; stopBehavior?: string }>;
}

export class SetlistStorage {
  constructor() {
    this.ensureDir();
  }

  private async ensureDir() {
    try {
      await fs.mkdir(SETLISTS_DIR, { recursive: true });
    } catch (err) {
      console.error('[SetlistStorage] Failed to create setlists dir:', err);
    }
  }

  public async listFiles(): Promise<string[]> {
    await this.ensureDir();
    try {
      const files = await fs.readdir(SETLISTS_DIR);
      return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    } catch (err) {
      console.error('[SetlistStorage] Error listing setlists:', err);
      return [];
    }
  }

  public async save(name: string, order: string[], overrides?: Record<string, any>): Promise<void> {
    await this.ensureDir();
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(SETLISTS_DIR, `${safeName}.json`);

    const fileContent: SavedSetlistFile = {
      version: 1,
      name,
      createdAt: new Date().toISOString(),
      order,
      songOverrides: overrides,
    };

    await fs.writeFile(filePath, JSON.stringify(fileContent, null, 2), 'utf-8');
  }

  public async load(name: string): Promise<SavedSetlistFile | null> {
    await this.ensureDir();
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(SETLISTS_DIR, `${safeName}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as SavedSetlistFile;
    } catch (err) {
      console.error(`[SetlistStorage] Failed to load setlist ${name}:`, err);
      return null;
    }
  }
}
