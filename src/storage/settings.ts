import fs from 'fs/promises';
import path from 'path';
import { AppSettings } from '../types/index.js';

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

const defaultSettings: AppSettings = {
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

  public async load(): Promise<AppSettings> {
    try {
      const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
      const loaded = JSON.parse(data);
      this.settings = { ...defaultSettings, ...loaded };
    } catch (err) {
      // If file doesn't exist, save default
      await this.save();
    }
    return this.settings;
  }

  public async save(): Promise<void> {
    try {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf-8');
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
