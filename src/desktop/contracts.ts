export interface ScriptStatus { library: string; destination: string; bundledVersion: string; installedVersion?: string; state: 'missing' | 'current' | 'different'; }
export interface UpdateResult { status: 'current' | 'available' | 'unavailable'; version?: string; notes?: string; url?: string; message?: string; }
export interface DesktopApi {
  info(): Promise<{ version: string; platform: string; arch: string; setupComplete: boolean }>;
  scriptStatus(): Promise<ScriptStatus>;
  chooseLibrary(): Promise<ScriptStatus | null>;
  installScript(): Promise<ScriptStatus | null>;
  finishSetup(): Promise<void>;
  checkUpdates(): Promise<UpdateResult>;
  openLink(link: 'issues' | 'releases' | 'ableton-js' | 'download'): Promise<void>;
  diagnostics(): Promise<boolean>;
  licenses(): Promise<string>;
  onHelp(callback: () => void): () => void;
}
