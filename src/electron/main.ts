import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { startBackendServer } from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  console.log('[Electron] Starting embedded Alive Set Manager backend...');
  const port = await startBackendServer().catch(err => {
    console.error('[Electron] Backend startup error:', err);
    return 8080;
  });

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 850,
    minHeight: 600,
    title: 'Alive Set Manager',
    titleBarStyle: 'default',
    backgroundColor: '#121212',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const baseDir = __dirname.includes('app.asar.unpacked')
    ? __dirname
    : __dirname.replace('app.asar', 'app.asar.unpacked');

  const localFrontendPaths = [
    path.resolve(baseDir, '../../../frontend/dist/index.html'),
    path.resolve(baseDir, '../../frontend/dist/index.html'),
    path.resolve(__dirname, '../../../frontend/dist/index.html'),
    path.resolve(__dirname, '../../frontend/dist/index.html'),
    path.resolve(app.getAppPath(), 'frontend/dist/index.html'),
    path.resolve(app.getAppPath(), 'dist/frontend/index.html'),
    path.resolve(process.cwd(), 'frontend/dist/index.html'),
    path.resolve(process.cwd(), 'dist/frontend/index.html'),
  ];

  console.log('[Electron Debug] __dirname:', __dirname);
  console.log('[Electron Debug] baseDir:', baseDir);
  console.log('[Electron Debug] app.getAppPath():', app.getAppPath());
  console.log('[Electron Debug] process.cwd():', process.cwd());

  localFrontendPaths.forEach(p => {
    console.log(`[Electron Debug] Checking path "${p}": exists = ${fs.existsSync(p)}`);
  });

  const indexPath = localFrontendPaths.find(p => fs.existsSync(p));
  console.log('[Electron Debug] Resolved indexPath:', indexPath);

  if (process.env.VITE_DEV_SERVER_URL) {
    console.log(`[Electron] Loading UI from dev server at ${process.env.VITE_DEV_SERVER_URL}...`);
    const devUrl = new URL(process.env.VITE_DEV_SERVER_URL);
    devUrl.searchParams.set('backendPort', String(port));
    await mainWindow.loadURL(devUrl.toString());
  } else if (indexPath) {
    console.log(`[Electron] Loading UI from local file: ${indexPath} (backendPort=${port})`);
    await mainWindow.loadFile(indexPath, { query: { backendPort: String(port) } });
  } else {
    console.log(`[Electron] Loading UI from http://localhost:${port}...`);
    await mainWindow.loadURL(`http://localhost:${port}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
