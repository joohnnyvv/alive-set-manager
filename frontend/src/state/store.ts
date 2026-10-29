import { createSignal } from 'solid-js';
import { createStore, reconcile, produce } from 'solid-js/store';
import { WsClient } from '../api/websocket.js';
import { showToast } from '../components/Toast.js';
import type { AppState, ServerEvent, ClientAction, AppSettings } from '../types.js';

const savedTheme = (localStorage.getItem('app-theme') as any) || 'midnight';
document.documentElement.setAttribute('data-theme', savedTheme);

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

const initialState: AppState = {
  connection: 'connecting',
  setlist: {
    songs: [],
    order: [],
    isPlaying: false,
    currentTime: 0,
    tempo: 120,
    totalDuration: 0,
    remainingTime: 0,
  },
  playback: {
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
  },
  settings: initialSettings,
  midi: {
    inputs: [],
    outputs: [],
    mappings: [],
    learning: false,
    learningMappingId: undefined,
  },
  currentView: 'setlist',
};

let receivedInitialState = false;
let viewChosen = false;

export const [store, setStore] = createStore<AppState>(initialState);
export const [connection, setConnection] = createSignal<'connected' | 'disconnected' | 'connecting'>('connecting');

const handleMessage = (event: ServerEvent) => {
  switch (event.type) {
    case 'state': {
      const payload = event.payload;
      setStore('liveConnected', !!payload.liveConnected);
      if (payload.setlist) setStore('setlist', reconcile(payload.setlist));
      if (payload.playback) setStore('playback', reconcile(payload.playback));
      if (payload.settings) {
        setStore('settings', reconcile(payload.settings));
        if (!receivedInitialState && !viewChosen && payload.settings.defaultView) {
          setStore('currentView', payload.settings.defaultView);
        }
        if (payload.settings.theme) {
          applyTheme(payload.settings.theme);
        }
      }
      if (payload.midi) {
        setStore('midi', 'inputs', payload.midi.inputs || []);
        setStore('midi', 'outputs', payload.midi.outputs || []);
        setStore('midi', 'mappings', payload.midi.mappings || []);
      }
      receivedInitialState = true;
      break;
    }
    case 'playback.tick': {
      const p = event.payload;
      if (p.currentTime !== undefined) setStore('playback', 'currentTime', p.currentTime);
      if (p.isPlaying !== undefined) setStore('playback', 'isPlaying', p.isPlaying);
      if (p.tempo !== undefined) setStore('playback', 'tempo', p.tempo);
      if (p.songProgress !== undefined) setStore('playback', 'songProgress', p.songProgress);
      if (p.sectionProgress !== undefined) setStore('playback', 'sectionProgress', p.sectionProgress);
      if (p.remainingTimeInSong !== undefined) setStore('playback', 'remainingTimeInSong', p.remainingTimeInSong);
      break;
    }
    case 'playback.songChanged': {
      setStore('playback', 'activeSongId', event.payload.songId);
      setStore('setlist', 'activeSongId', event.payload.songId);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(50);
        } catch {
          // ignore
        }
      }
      break;
    }
    case 'playback.sectionChanged': {
      setStore('playback', 'activeSectionId', event.payload.sectionId);
      setStore('setlist', 'activeSectionId', event.payload.sectionId);
      break;
    }
    case 'playback.queued': {
      setStore('playback', 'queuedSongId', event.payload.songId);
      setStore('playback', 'queuedSectionId', event.payload.sectionId);
      setStore('setlist', 'queuedSongId', event.payload.songId);
      setStore('setlist', 'queuedSectionId', event.payload.sectionId);
      break;
    }
    case 'playback.queueCleared': {
      setStore('playback', 'queuedSongId', undefined);
      setStore('playback', 'queuedSectionId', undefined);
      setStore('setlist', 'queuedSongId', undefined);
      setStore('setlist', 'queuedSectionId', undefined);
      break;
    }
    case 'setlist.updated': {
      setStore('setlist', reconcile(event.payload));
      break;
    }
    case 'setlist.saved': {
      showToast(`Setlist "${event.payload.name}" saved!`, 'success');
      break;
    }
    case 'midi.devices': {
      setStore('midi', 'inputs', event.payload.inputs || []);
      setStore('midi', 'outputs', event.payload.outputs || []);
      break;
    }
    case 'midi.mappings': {
      setStore('midi', 'mappings', event.payload || []);
      break;
    }
    case 'midi.learning': {
      setStore('midi', 'learning', true);
      setStore('midi', 'learningMappingId', event.payload.mappingId);
      break;
    }
    case 'midi.learned': {
      showToast('MIDI mapping learned!', 'success');
      setStore('midi', 'learning', false);
      setStore('midi', 'learningMappingId', undefined);
      if (event.payload.mappings) {
        setStore('midi', 'mappings', event.payload.mappings);
      } else if (event.payload.mapping) {
        const learned = event.payload.mapping;
        setStore('midi', 'mappings', produce(mappings => {
          const idx = mappings.findIndex(m => m.id === learned.id);
          if (idx !== -1) {
            mappings[idx] = learned;
          } else {
            mappings.push(learned);
          }
        }));
      }
      break;
    }
    case 'error': {
      showToast(event.payload.message || 'An error occurred', 'error');
      break;
    }
    default:
      console.warn('Unhandled event type', (event as any).type);
  }
};

const handleStatusChange = (status: 'connected' | 'disconnected' | 'connecting') => {
  setConnection(status);
  setStore('connection', status);
};

const wsClient = new WsClient(handleMessage, handleStatusChange);
wsClient.connect();

export const dispatch = (action: ClientAction) => {
  wsClient.send(action);
};

export const setView = (view: AppState['currentView']) => {
  viewChosen = true;
  setStore('currentView', view);
};

export const applyTheme = (theme: string) => {
  setStore('settings', 'theme', theme as any);
  localStorage.setItem('app-theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
};
