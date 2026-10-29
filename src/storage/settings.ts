import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { AppSettings } from '../types/index.js';

import { dataDirectory, atomicJson, readJson } from './files.js';

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

const VALID_THEMES = new Set(['midnight', 'live-dark', 'live-light', 'high-contrast', 'soft-dark']);
const VALID_JUMP_MODES = new Set(['quantized', 'end-of-section', 'end-of-song', 'dynamic', 'manual']);
const VALID_DEFAULT_VIEWS = new Set(['setlist', 'performance', 'sections']);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: Partial<AppSettings>;
}

export function validateSettingsPayload(payload: unknown): ValidationResult {
  const errors: string[] = [];
  const sanitized: Partial<AppSettings> = {};

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['Settings payload must be a JSON object'], sanitized: {} };
  }

  const obj = payload as Record<string, unknown>;
  const allowedKeys = new Set<string>([
    'theme',
    'jumpMode',
    'autoJumpToNextSong',
    'alwaysStopOnSongEnd',
    'restartSongBeforeJumpingBack',
    'disableLoopWhenJumping',
    'defaultView',
    'show24HourClock',
    'preferredPort',
    'lanMode',
    'authToken',
  ]);

  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unknown setting key: "${key}"`);
      continue;
    }

    const val = obj[key];

    switch (key) {
      case 'theme':
        if (typeof val === 'string' && VALID_THEMES.has(val)) {
          sanitized.theme = val as any;
        } else {
          errors.push(`Invalid theme: "${val}". Must be one of: ${[...VALID_THEMES].join(', ')}`);
        }
        break;
      case 'jumpMode':
        if (typeof val === 'string' && VALID_JUMP_MODES.has(val)) {
          sanitized.jumpMode = val as any;
        } else {
          errors.push(`Invalid jumpMode: "${val}". Must be one of: ${[...VALID_JUMP_MODES].join(', ')}`);
        }
        break;
      case 'autoJumpToNextSong':
      case 'alwaysStopOnSongEnd':
      case 'restartSongBeforeJumpingBack':
      case 'disableLoopWhenJumping':
      case 'show24HourClock':
      case 'lanMode':
        if (typeof val === 'boolean') {
          sanitized[key] = val;
        } else {
          errors.push(`Setting "${key}" must be a boolean`);
        }
        break;
      case 'defaultView':
        if (typeof val === 'string' && VALID_DEFAULT_VIEWS.has(val)) {
          sanitized.defaultView = val as any;
        } else {
          errors.push(`Invalid defaultView: "${val}". Must be one of: ${[...VALID_DEFAULT_VIEWS].join(', ')}`);
        }
        break;
      case 'preferredPort':
        if (typeof val === 'number' && Number.isInteger(val) && val >= 1024 && val <= 65535) {
          sanitized.preferredPort = val;
        } else {
          errors.push(`Invalid preferredPort: "${val}". Must be an integer between 1024 and 65535`);
        }
        break;
      case 'authToken':
        if (typeof val === 'string' && val.length <= 256) {
          sanitized.authToken = val.trim() || undefined;
        } else {
          errors.push(`Setting "authToken" must be a string up to 256 characters`);
        }
        break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

export class SettingsStorage {
  private settings: AppSettings = { ...defaultSettings };

  constructor(private readonly directory = dataDirectory()) {}

  public async load(): Promise<AppSettings> {
    const loaded = await readJson(path.join(this.directory, 'settings.json'));
    if (loaded === undefined) { await this.save(); return this.settings; }
    const validation = validateSettingsPayload(loaded);
    if (!validation.valid) throw new Error('Invalid saved settings. Original file retained.');
    this.settings = { ...defaultSettings, ...validation.sanitized };
    return this.settings;
  }

  public async save(): Promise<void> {
    await atomicJson(path.join(this.directory, 'settings.json'), this.settings);
  }

  public publicSettings(): AppSettings {
    const { authToken, ...safe } = this.settings;
    return safe;
  }

  public getSettings(): AppSettings {
    return this.settings;
  }

  public async updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<AppSettings> {
    const validation = validateSettingsPayload({ [key]: value });
    if (!validation.valid) {
      throw new Error(`Validation failed for setting "${key}": ${validation.errors.join(', ')}`);
    }
    const next = { ...this.settings, ...validation.sanitized };
    await atomicJson(path.join(this.directory, 'settings.json'), next);
    this.settings = next;
    return this.settings;
  }

  public async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const validation = validateSettingsPayload(updates);
    if (!validation.valid) {
      throw new Error(`Validation failed for settings: ${validation.errors.join(', ')}`);
    }
    const next = { ...this.settings, ...validation.sanitized };
    await atomicJson(path.join(this.directory, 'settings.json'), next);
    this.settings = next;
    return this.settings;
  }
}
