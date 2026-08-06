import { AppState, ServerEvent, ClientAction, AppSettings, Setlist, PlaybackState } from '../types.js';
import { WsClient } from '../api/websocket.js';
import { showToast } from '../components/Toast.js';

function safeVibrate(pattern: number | number[]): void {
  try {
    if (
      typeof navigator !== 'undefined' &&
      'vibrate' in navigator &&
      typeof navigator.vibrate === 'function' &&
      (navigator as any).userActivation?.hasBeenActive
    ) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore browser user-activation intervention errors
  }
}

const savedTheme = (localStorage.getItem('app-theme') as any) || 'midnight';

const initialSettings: AppSettings = {
  theme: savedTheme,
  jumpMode: 'quantized',
  autoJumpToNextSong: true,
  alwaysStopOnSongEnd: false,
  restartSongBeforeJumpingBack: false,
  disableLoopWhenJumping: true,
  defaultView: 'setlist',
  show24HourClock: true,
  preferredPort: 8080,
};

const initialSetlist: Setlist = {
  songs: [],
  order: [],
  isPlaying: false,
  currentTime: 0,
  tempo: 120,
  totalDuration: 0,
  remainingTime: 0,
};

const initialPlayback: PlaybackState = {
  isPlaying: false,
  isPaused: false,
  currentTime: 0,
  tempo: 120,
  songProgress: 0,
  sectionProgress: 0,
  isLooping: false,
  isCountingIn: false,
  remainingTimeInSong: 0,
  remainingTimeInSet: 0,
};

export class Store {
  private state: AppState;
  private listeners: Set<(state: AppState) => void> = new Set();
  private wsClient: WsClient;

  constructor() {
    this.state = {
      connection: 'disconnected',
      setlist: initialSetlist,
      playback: initialPlayback,
      settings: initialSettings,
      midi: {
        inputs: [],
        outputs: [],
        mappings: [],
        learning: false,
      },
      currentView: 'setlist',
    };

    this.wsClient = new WsClient(
      (msg) => this.handleServerEvent(msg),
      (status) => {
        this.state.connection = status;
        this.notify();
      }
    );

    this.applyTheme(this.state.settings.theme || savedTheme);
    this.wsClient.connect();
  }

  public applyTheme(theme: string): void {
    if (!theme) return;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }

  public getState(): AppState {
    return this.state;
  }

  public subscribe(cb: (state: AppState) => void): () => void {
    this.listeners.add(cb);
    cb(this.state);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private handleServerEvent(msg: ServerEvent): void {
    switch (msg.type) {
      case 'state':
        this.state.setlist = msg.payload.setlist;
        this.state.playback = msg.payload.playback;
        this.state.settings = msg.payload.settings;
        if (msg.payload.midi) {
          this.state.midi.inputs = msg.payload.midi.inputs || [];
          this.state.midi.outputs = msg.payload.midi.outputs || [];
          this.state.midi.mappings = msg.payload.midi.mappings || [];
        }
        if (msg.payload.settings.theme) {
          this.applyTheme(msg.payload.settings.theme);
        }
        if (msg.payload.settings.defaultView && this.state.currentView === 'setlist') {
          this.state.currentView = msg.payload.settings.defaultView;
        }
        break;

      case 'playback.tick':
        this.state.playback.currentTime = msg.payload.currentTime;
        this.state.playback.isPlaying = msg.payload.isPlaying;
        this.state.playback.tempo = msg.payload.tempo;
        this.state.playback.songProgress = msg.payload.songProgress;
        this.state.playback.sectionProgress = msg.payload.sectionProgress;
        this.state.playback.remainingTimeInSong = msg.payload.remainingTimeInSong;
        this.state.setlist.currentTime = msg.payload.currentTime;
        this.state.setlist.isPlaying = msg.payload.isPlaying;
        break;

      case 'playback.songChanged':
        this.state.playback.activeSongId = msg.payload.songId;
        this.state.setlist.activeSongId = msg.payload.songId;
        safeVibrate(50);
        break;

      case 'playback.sectionChanged':
        this.state.playback.activeSectionId = msg.payload.sectionId;
        this.state.setlist.activeSectionId = msg.payload.sectionId;
        break;

      case 'playback.queued':
        this.state.playback.queuedSongId = msg.payload.songId;
        this.state.playback.queuedSectionId = msg.payload.sectionId;
        this.state.setlist.queuedSongId = msg.payload.songId;
        this.state.setlist.queuedSectionId = msg.payload.sectionId;
        break;

      case 'playback.queueCleared':
        this.state.playback.queuedSongId = undefined;
        this.state.playback.queuedSectionId = undefined;
        this.state.setlist.queuedSongId = undefined;
        this.state.setlist.queuedSectionId = undefined;
        break;

      case 'setlist.updated':
        this.state.setlist = msg.payload;
        break;

      case 'midi.devices':
        this.state.midi.inputs = msg.payload.inputs;
        this.state.midi.outputs = msg.payload.outputs;
        break;

      case 'midi.mappings':
        this.state.midi.mappings = msg.payload;
        break;

      case 'midi.learning':
        this.state.midi.learning = true;
        this.state.midi.learningMappingId = msg.payload.mappingId;
        break;

      case 'midi.learned':
        this.state.midi.learning = false;
        this.state.midi.learningMappingId = undefined;
        if (msg.payload.mappings) {
          this.state.midi.mappings = msg.payload.mappings;
        } else if (msg.payload.mapping) {
          const idx = this.state.midi.mappings.findIndex(m => m.id === msg.payload.mappingId);
          if (idx !== -1) {
            this.state.midi.mappings[idx] = msg.payload.mapping;
          } else {
            this.state.midi.mappings.push(msg.payload.mapping);
          }
        }
        const m = msg.payload.mapping;
        const noteDetail = m.note !== undefined ? `Note:${m.note}` : m.cc !== undefined ? `CC:${m.cc}` : '';
        showToast(`MIDI Learned: "${m.inputName || 'Device'}" (${m.messageType.toUpperCase()} Ch:${m.channel} ${noteDetail})`, 'success');
        break;
    }
    this.notify();
  }

  public dispatch(action: ClientAction): void {
    if (action.type === 'settings.set') {
      (this.state.settings as any)[action.key] = action.value;
      if (action.key === 'theme') {
        this.applyTheme(action.value);
      }
    }
    this.wsClient.send(action);
  }

  public setView(view: AppState['currentView']): void {
    this.state.currentView = view;
    this.notify();
  }
}

export const store = new Store();
