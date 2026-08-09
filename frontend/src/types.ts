export interface LocatorFlags {
  pause: boolean;
  loop: boolean;
  loopFull: boolean;
  loopCount?: number;
  skip: boolean;
  end: boolean;
  jump: boolean;
  stay: boolean;
  nosong: boolean;
  quickJump: boolean;
}

export interface Section {
  id: string;
  originalId?: string;
  name: string;
  description?: string;
  chords?: string;
  startTime: number;
  endTime: number;
  duration: number;
  color?: string;
  flags: LocatorFlags;
  transitionTarget?: string;
}

export type StopBehavior = 'auto-jump' | 'stop' | 'pause' | 'default';

export interface Song {
  id: string;
  originalId?: string;
  isDuplicate?: boolean;
  name: string;
  description?: string;
  startTime: number;
  endTime: number;
  duration: number;
  durationOverride?: number;
  targetTempo?: number;
  color?: string;
  tags: string[];
  sections: Section[];
  stopBehavior: StopBehavior;
  isNonSong: boolean;
  isSkipped: boolean;
}

export interface Setlist {
  songs: Song[];
  order: string[];
  activeSongId?: string;
  activeSectionId?: string;
  queuedSongId?: string;
  queuedSectionId?: string;
  isPlaying: boolean;
  currentTime: number;
  tempo: number;
  totalDuration: number;
  remainingTime: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  tempo: number;
  activeSongId?: string;
  activeSectionId?: string;
  queuedSongId?: string;
  queuedSectionId?: string;
  songProgress: number;
  sectionProgress: number;
  isLooping: boolean;
  isCountingIn: boolean;
  remainingTimeInSong: number;
  remainingTimeInSet: number;
}

export type JumpMode = 'quantized' | 'end-of-section' | 'end-of-song' | 'dynamic' | 'manual';

export type AppTheme = 'midnight' | 'live-dark' | 'live-light' | 'high-contrast' | 'soft-dark';

export interface AppSettings {
  theme: AppTheme;
  jumpMode: JumpMode;
  autoJumpToNextSong: boolean;
  alwaysStopOnSongEnd: boolean;
  restartSongBeforeJumpingBack: boolean;
  disableLoopWhenJumping: boolean;
  defaultView: 'setlist' | 'performance' | 'sections';
  show24HourClock: boolean;
  preferredPort: number;
  lanMode?: boolean;
  authToken?: string;
}

export type MidiMessageType = 'note-on' | 'note-off' | 'cc' | 'pc';

export type MidiAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'next-song' }
  | { type: 'prev-song' }
  | { type: 'next-section' }
  | { type: 'prev-section' }
  | { type: 'jump-to-song'; songIndex: number }
  | { type: 'jump-to-section'; sectionIndex: number }
  | { type: 'toggle-loop' }
  | { type: 'go' }
  | { type: 'cancel-queue' };

export interface MidiMapping {
  id: string;
  inputName: string;
  messageType: MidiMessageType;
  channel: number;
  note?: number;
  cc?: number;
  value?: number;
  action: MidiAction;
}

export interface AppState {
  connection: 'connected' | 'disconnected' | 'connecting';
  setlist: Setlist;
  playback: PlaybackState;
  settings: AppSettings;
  midi: {
    inputs: string[];
    outputs: string[];
    mappings: MidiMapping[];
    learning: boolean;
    learningMappingId?: string;
  };
  currentView: 'setlist' | 'performance' | 'sections' | 'settings';
}

export type ServerEvent =
  | { type: 'state'; payload: { setlist: Setlist; playback: PlaybackState; settings: AppSettings; midi?: { inputs: string[]; outputs: string[]; mappings: MidiMapping[] } } }
  | { type: 'playback.tick'; payload: { currentTime: number; isPlaying: boolean; tempo: number; songProgress: number; sectionProgress: number; remainingTimeInSong: number } }
  | { type: 'playback.songChanged'; payload: { songId: string; previousSongId?: string } }
  | { type: 'playback.sectionChanged'; payload: { sectionId: string; previousSectionId?: string } }
  | { type: 'playback.queued'; payload: { songId?: string; sectionId?: string } }
  | { type: 'playback.queueCleared'; payload: {} }
  | { type: 'setlist.updated'; payload: Setlist }
  | { type: 'setlist.saved'; payload: { name: string } }
  | { type: 'midi.devices'; payload: { inputs: string[]; outputs: string[] } }
  | { type: 'midi.mappings'; payload: MidiMapping[] }
  | { type: 'midi.learning'; payload: { mappingId: string } }
  | { type: 'midi.learned'; payload: { mappingId: string; mapping: MidiMapping; mappings?: MidiMapping[] } }
  | { type: 'error'; payload: { message: string; code: string } };

export type ClientAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'go' }
  | { type: 'next-song' }
  | { type: 'prev-song' }
  | { type: 'next-section' }
  | { type: 'prev-section' }
  | { type: 'jump-to-song'; songId: string }
  | { type: 'jump-to-section'; sectionId: string }
  | { type: 'queue-song'; songId: string }
  | { type: 'queue-section'; sectionId: string }
  | { type: 'cancel-queue' }
  | { type: 'setlist.reorder'; order: string[] }
  | { type: 'setlist.remove-song'; songId: string }
  | { type: 'setlist.restore-song'; songId: string }
  | { type: 'setlist.duplicate-song'; songId: string }
  | { type: 'setlist.delete-song'; songId: string }
  | { type: 'setlist.update-song'; songId: string; overrides: { color?: string; stopBehavior?: StopBehavior; duration?: number } }
  | { type: 'setlist.update-section-chords'; sectionId: string; chords: string }
  | { type: 'setlist.import-text'; text: string }
  | { type: 'setlist.save'; name: string }
  | { type: 'setlist.load'; name: string }
  | { type: 'settings.set'; key: string; value: any }
  | { type: 'midi.learn'; mappingId: string }
  | { type: 'midi.add-mapping'; mapping: MidiMapping }
  | { type: 'midi.remove-mapping'; mappingId: string }
  | { type: 'midi.update-mapping'; mapping: MidiMapping };
