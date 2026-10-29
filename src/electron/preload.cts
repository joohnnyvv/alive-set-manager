import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../desktop/contracts.js';
const invoke = (method: string, ...args: unknown[]) => ipcRenderer.invoke(`desktop:${method}`, ...args);
const api: DesktopApi = {
  info: () => invoke('info'), scriptStatus: () => invoke('script-status'),
  chooseLibrary: () => invoke('choose-library'), installScript: () => invoke('install-script'),
  finishSetup: () => invoke('finish-setup'), checkUpdates: () => invoke('updates'),
  openLink: link => invoke('link', link), diagnostics: () => invoke('diagnostics'), licenses: () => invoke('licenses'),
  onHelp: callback => { const listener = () => callback(); ipcRenderer.on('desktop:help', listener); return () => ipcRenderer.removeListener('desktop:help', listener); },
};
contextBridge.exposeInMainWorld('desktop', api);
