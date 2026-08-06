import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { AppSettings } from '../types/index.js';

function getStorageDir(): string {
  return path.join(os.homedir(), '.ableset');
}

function getSettingsFilePath(): string {
  return path.join(getStorageDir(), 'settings.json');
}

const defaultSettings: AppSettings = {
  theme: 'midnight',
  jumpMode: 'quantized',
  autoJumpToNextSong: true,
  alwaysStopOnSongEnd: false,
  restartSongBeforeJumpingBack: false,
  disableLoopWhenJumping: true,
  defaultView: 'setlist',
  show24HourClock: true,
  preferredPort: 8080,
};

export class SettingsStorage {
  private settings: AppSettings = { ...defaultSettings };

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(getStorageDir(), { recursive: true });
    } catch (err) {
      console.error('[SettingsStorage] Error creating settings directory:', err);
    }
  }

  public async load(): Promise<AppSettings> {
    await this.ensureDir();
    const filePath = getSettingsFilePath();
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const loaded = JSON.parse(data);
      this.settings = { ...defaultSettings, ...loaded };
    } catch (err) {
      // If file doesn't exist, save default
      await this.save();
    }
    return this.settings;
  }

  public async save(): Promise<void> {
    await this.ensureDir();
    const filePath = getSettingsFilePath();
    try {
      await fs.writeFile(filePath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SettingsStorage] Error saving settings:', err);
    }
  }

  public getSettings(): AppSettings {
    return this.settings;
  }

  public async updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<AppSettings> {
    this.settings[key] = value;
    await this.save();
    return this.settings;
  }
}
