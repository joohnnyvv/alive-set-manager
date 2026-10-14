import fs from 'fs';
import os from 'os';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { SetlistEngine } from '../engine/setlist.js';
import { AbletonBridge } from '../ableton/bridge.js';
import { SettingsStorage } from '../storage/settings.js';
import { SetlistStorage } from '../storage/setlist.js';
import { PlaybackState } from '../types/index.js';
import { MidiEngine } from '../midi/engine.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin || origin === 'null' || origin === 'file://') return true;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }
    const localIps = getLocalIpAddresses();
    if (localIps.includes(hostname)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function createHttpServer(
  setlistEngine: SetlistEngine,
  abletonBridge: AbletonBridge,
  settingsStorage: SettingsStorage,
  setlistStorage: SetlistStorage,
  getPlaybackState: () => PlaybackState,
  midiEngine?: MidiEngine
) {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Cross-origin request blocked by security policy'));
        }
      },
      credentials: true,
    })
  );
  app.use(express.json());

  // Optional Token Authentication for API routes
  app.use('/api', (req: Request, res: Response, next) => {
    const settings = settingsStorage.getSettings();
    if (settings.authToken) {
      const token = req.headers['x-auth-token'] || req.query.token;
      if (token !== settings.authToken) {
        res.status(401).json({ error: 'Unauthorized: Invalid or missing auth token' });
        return;
      }
    }
    next();
  });

  // Static files for production build (supports local dev, node dist, packaged Electron .app, and asarUnpack)
  const baseDir = __dirname.includes('app.asar.unpacked')
    ? __dirname
    : __dirname.replace('app.asar', 'app.asar.unpacked');

  const possiblePaths = [
    path.resolve(baseDir, '../../../frontend/dist'),
    path.resolve(baseDir, '../../frontend/dist'),
    path.resolve(__dirname, '../../../frontend/dist'),
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(__dirname, '../frontend'),
    path.resolve(process.cwd(), 'frontend', 'dist'),
    path.resolve(process.cwd(), 'dist', 'frontend'),
  ];

  possiblePaths.forEach(p => {
    console.log(`[HttpServer Debug] Checking static path "${p}": exists = ${fs.existsSync(p)}`);
  });

  const staticPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
  console.log('[HttpServer] Serving static frontend from:', staticPath);

  app.use(express.static(staticPath));

  // REST API Endpoints
  app.get('/api/state', (req: Request, res: Response) => {
    const tempo = abletonBridge.getTempo();
    const currentTime = abletonBridge.getCurrentSongTime();
    const isPlaying = abletonBridge.isPlaying();
    const setlist = setlistEngine.getSetlistState(tempo, currentTime, isPlaying);
    const playback = getPlaybackState();
    const settings = settingsStorage.getSettings();
    const midiDevices = midiEngine ? midiEngine.getDevices() : { inputs: [], outputs: [] };
    const midiMappings = midiEngine ? midiEngine.getMappings() : [];

    res.json({
      setlist,
      playback,
      settings,
      midi: {
        inputs: midiDevices.inputs,
        outputs: midiDevices.outputs,
        mappings: midiMappings,
        learning: false,
      },
    });
  });

  app.get('/api/setlist', (req: Request, res: Response) => {
    const setlist = setlistEngine.getSetlistState(
      abletonBridge.getTempo(),
      abletonBridge.getCurrentSongTime(),
      abletonBridge.isPlaying()
    );
    res.json(setlist);
  });

  app.post('/api/setlist/save', async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Valid setlist name is required' });
      return;
    }
    const setlist = setlistEngine.getSetlistState();
    await setlistStorage.save(name.trim(), setlist.order, setlistEngine.getSongOverrides());
    res.json({ success: true, name: name.trim() });
  });

  app.post('/api/setlist/load', async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    const loaded = await setlistStorage.load(name);
    if (!loaded) {
      res.status(404).json({ error: 'Setlist not found' });
      return;
    }
    setlistEngine.reorder(loaded.order);
    setlistEngine.applySongOverrides(loaded.songOverrides);
    res.json({ success: true, loaded });
  });

  app.get('/api/setlist/files', async (req: Request, res: Response) => {
    const files = await setlistStorage.listFiles();
    res.json(files);
  });

  app.get('/api/songs', (req: Request, res: Response) => {
    const setlist = setlistEngine.getSetlistState();
    res.json(setlist.songs);
  });

  app.get('/api/ips', (req: Request, res: Response) => {
    const ips = getLocalIpAddresses();
    res.json({ ips, port: settingsStorage.getSettings().preferredPort || 8080 });
  });

  app.get('/api/settings', (req: Request, res: Response) => {
    res.json(settingsStorage.getSettings());
  });

  app.post('/api/settings', async (req: Request, res: Response) => {
    try {
      const updated = await settingsStorage.updateSettings(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Invalid settings payload' });
    }
  });

  app.get('/api/midi/devices', (req: Request, res: Response) => {
    const devices = midiEngine ? midiEngine.getDevices() : { inputs: [], outputs: [] };
    res.json(devices);
  });

  app.get('/api/midi/mappings', (req: Request, res: Response) => {
    const mappings = midiEngine ? midiEngine.getMappings() : [];
    res.json(mappings);
  });

  app.post('/api/midi/mappings', async (req: Request, res: Response) => {
    if (midiEngine && Array.isArray(req.body)) {
      // Validate mapping objects
      const valid = req.body.every(m => m && typeof m === 'object' && typeof m.id === 'string' && m.action && typeof m.action.type === 'string');
      if (!valid) {
        res.status(400).json({ error: 'Invalid mappings structure' });
        return;
      }
      await midiEngine.setMappings(req.body);
      res.json({ success: true, mappings: midiEngine.getMappings() });
    } else {
      res.status(400).json({ error: 'Invalid mappings array' });
    }
  });

  // SPA Fallback Route for non-API routes (Express 5 compatible)
  app.use((req: Request, res: Response, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    const indexPath = path.join(staticPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend build not found. Please run `npm run build`.');
    }
  });

  return app;
}
