import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startBackendServer, type BackendHandle } from '../index.js';
import { atomicJson, readJson } from '../storage/files.js';
import { scriptStatus, installScript } from '../desktop/script-installer.js';
import { checkUpdates, repository } from '../desktop/updates.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const resources = app.isPackaged ? process.resourcesPath : path.join(root, 'resources');
let window: BrowserWindow | null = null;
let backend: BackendHandle | undefined;
let quitting = false;
let starting = false;
let installationInProgress = false;
let downloadUrl: string | undefined;
app.setName('Alive Set Manager');
const dataDir = process.env.ASM_DATA_DIR || app.getPath('userData');
const setupFile = path.join(dataDir, 'desktop.json');
let preferences: { setupComplete?: boolean; library?: string } = {};
const library = () => preferences.library || path.join(app.getPath(process.platform === 'win32' ? 'documents' : 'music'), 'Ableton', 'User Library');
const source = path.join(resources, 'AbletonJS');

function registerIPC() {
  const methods: Record<string, (...args: any[]) => unknown> = {
    info: () => ({ version: app.getVersion(), platform: process.platform, arch: process.arch, setupComplete: !!preferences.setupComplete }),
    'script-status': () => scriptStatus(source, library()),
    'choose-library': async () => {
      const result = await dialog.showOpenDialog(window!, { title: 'Choose Ableton User Library', defaultPath: library(), properties: ['openDirectory', 'createDirectory'] });
      if (result.canceled) return null;
      const next = { ...preferences, library: result.filePaths[0] };
      const status = await scriptStatus(source, next.library);
      await atomicJson(setupFile, next); preferences = next;
      return status;
    },
    'install-script': async () => {
      if (installationInProgress) throw new Error('Script installation is already in progress.');
      installationInProgress = true;
      try {
        const status = await scriptStatus(source, library());
        if (status.state === 'current') return status;
        const result = await dialog.showMessageBox(window!, {
          type: 'question', title: 'Install AbletonJS',
          message: status.state === 'different' ? 'Back up and replace the existing AbletonJS script?' : 'Install AbletonJS in your User Library?',
          detail: `${status.destination}\n\nLive will not restart automatically. Existing scripts are backed up under Alive Set Manager Backups in your User Library.`,
          buttons: ['Cancel', 'Install'], defaultId: 0, cancelId: 0,
        });
        return result.response === 1 ? await installScript(source, library(), status.state === 'different') : null;
      } finally { installationInProgress = false; }
    },
    'finish-setup': async () => { const next = { ...preferences, setupComplete: true }; await atomicJson(setupFile, next); preferences = next; },
    updates: async () => { const result = await checkUpdates(app.getVersion(), process.platform, process.arch); downloadUrl = result.url; return result; },
    link: async (key: unknown) => {
      const links: Record<string, string | undefined> = { issues: `${repository}/issues`, releases: `${repository}/releases`, 'ableton-js': 'https://github.com/leolabs/ableton-js', download: downloadUrl };
      if (typeof key !== 'string' || !Object.hasOwn(links, key) || !links[key]) throw new Error('Unsupported link.');
      await shell.openExternal(links[key]!);
    },
    licenses: () => fs.readFile(path.join(resources, 'THIRD_PARTY_NOTICES.txt'), 'utf8'),
    diagnostics: async () => {
      const result = await dialog.showSaveDialog(window!, { defaultPath: 'alive-diagnostics.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (result.canceled || !result.filePath) return false;
      // Explicit allowlist: no raw logs, settings, tokens, paths or song names.
      await atomicJson(result.filePath, { app: 'Alive Set Manager', version: app.getVersion(), platform: process.platform, arch: process.arch,
        electron: process.versions.electron, liveConnected: backend?.live.isConnected() ?? false, playing: backend?.live.isPlaying() ?? false,
        cueCount: backend?.live.getRawCuePoints().length ?? 0, capturedAt: new Date().toISOString() });
      return true;
    },
  };
  for (const [name, handler] of Object.entries(methods)) ipcMain.handle(`desktop:${name}`, (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted desktop request.');
    if (event.senderFrame.url !== window.webContents.getURL()) throw new Error('Untrusted page.');
    if (args.length !== (name === 'link' ? 1 : 0)) throw new Error('Invalid arguments.');
    return handler(...args);
  });
}

async function createWindow() {
  if (starting || window) return;
  starting = true;
  try {
    if (!backend) {
      if (process.env.ASM_DEMO === '1') {
        if (!process.env.ASM_DATA_DIR) throw new Error('Demo requires an isolated data directory.');
        const { DemoLive, DemoMidi } = await import('../testing/demo.js');
        backend = await startBackendServer({ dataDir, live: new DemoLive(), midiFactory: (a,b,f) => new DemoMidi(a,b,f), migrate: false, port: 0 });
      } else backend = await startBackendServer({ dataDir });
    }
    window = new BrowserWindow({ width: 1280, height: 840, minWidth: 850, minHeight: 600, title: 'Alive Set Manager',
      backgroundColor: '#121212', icon: path.join(resources, 'icon.png'),
      webPreferences: { preload: path.join(root, 'dist/src/electron/preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    const url = new URL(process.env.VITE_DEV_SERVER_URL && !app.isPackaged ? process.env.VITE_DEV_SERVER_URL : `http://127.0.0.1:${backend.port}`);
    url.searchParams.set('backendPort', String(backend.port));
    if (backend.authToken) url.searchParams.set('token', backend.authToken);
    window.webContents.setWindowOpenHandler(({ url: target }) => {
      const allowed = [`${url.origin}/licenses/THIRD_PARTY_NOTICES.txt`, `${url.origin}/licenses/LICENSES.chromium.html`];
      return allowed.includes(target) ? { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: undefined } } } : { action: 'deny' };
    });
    window.webContents.on('will-navigate', (event, target) => { if (target !== url.toString()) event.preventDefault(); });
    window.on('closed', () => { window = null; });
    await window.loadURL(url.toString());
  } catch (error) {
    window?.destroy(); window = null;
    await backend?.close(); backend = undefined;
    const choice = await dialog.showMessageBox({ type: 'error', message: 'Alive Set Manager could not start.', detail: error instanceof Error ? error.message : String(error), buttons: ['Quit', 'Retry'], cancelId: 0 });
    if (choice.response === 1) { starting = false; return createWindow(); }
    app.quit();
  } finally { starting = false; }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } else void createWindow(); });
  app.whenReady().then(async () => {
    preferences = (await readJson(setupFile) as typeof preferences) || {};
    registerIPC();
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : [{ label: 'File', submenu: [{ role: 'quit' as const }] }]),
      { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
      { label: 'Help', submenu: [{ label: 'Setup, Help & About', click: () => window?.webContents.send('desktop:help') }] },
    ]));
    await createWindow();
  }).catch(error => { dialog.showErrorBox('Startup failed', String(error)); app.quit(); });
  app.on('activate', () => { void createWindow(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', event => {
    if (quitting || !backend) return;
    event.preventDefault(); quitting = true;
    void backend.close().finally(() => app.quit());
  });
}
