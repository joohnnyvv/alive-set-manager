export interface LocatorFlags {
  pause: boolean;        // +PAUSE
  loop: boolean;         // +LOOP
  loopFull: boolean;     // +LOOPFULL
  loopCount?: number;    // +LOOP:4
  skip: boolean;         // +SKIP
  end: boolean;          // +END
  jump: boolean;         // +JUMP
  stay: boolean;         // +STAY
  nosong: boolean;       // [nosong]
  quickJump: boolean;    // >>
}

export type LocatorType = 'song' | 'section' | 'song-end' | 'stop' | 'ignored';

export interface ParsedLocator {
  rawName: string;
  type: LocatorType;
  name: string;
  description?: string;
  chords?: string;       // Chord progression (e.g. "C - G - Am - F" or "C G Am F")
  time: number; // in beats
  color?: string;
  tags: string[];
  duration?: number; // seconds (override from [mm:ss])
  targetTempo?: number; // target BPM parsed from #140bpm or {bpm: 140}
  flags: LocatorFlags;
  transitionTarget?: string; // >>> Target
}

export type StopBehavior = 'auto-jump' | 'stop' | 'pause' | 'default';

export interface Section {
  id: string;
  originalId?: string;    // Reference to original cue ID if duplicated
  name: string;
  description?: string;
  chords?: string;       // Chord progression (e.g. "C - G - Am - F" or "C G Am F")
  startTime: number;       // beats
  endTime: number;         // beats
  duration: number;        // seconds
  color?: string;
  flags: LocatorFlags;
  transitionTarget?: string;
}

export interface Song {
  id: string;              // Unique identifier
  originalId?: string;    // Reference to original cue ID if duplicated
  isDuplicate?: boolean;  // True if song is a duplicate instance
  name: string;            // Display name
  description?: string;      // Parsed from {curly braces}
  startTime: number;       // Position in beats
  endTime: number;         // Position in beats
  duration: number;        // Duration in seconds
  targetTempo?: number;    // Target BPM parsed from metadata
  color?: string;          // Color name
  tags: string[];          // Parsed from #hashtags
  sections: Section[];
  stopBehavior: StopBehavior;
  isNonSong: boolean;      // [nosong] flag
  isSkipped: boolean;      // Removed from active setlist / skipped
}

export interface Setlist {
  songs: Song[];           // All available songs
  order: string[];         // Ordered song IDs (active setlist)
  activeSongId?: string;
  activeSectionId?: string;
  queuedSongId?: string;   // For jump modes that queue
  queuedSectionId?: string;
  isPlaying: boolean;
  currentTime: number;     // Current playhead in beats
  tempo: number;
  totalDuration: number;   // Sum of active song durations
  remainingTime: number;   // Remaining in entire set
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;       // !isPlaying && currentTime > 0
  currentTime: number;     // beats
  tempo: number;
  activeSongId?: string;
  activeSectionId?: string;
  queuedSongId?: string;
  queuedSectionId?: string;
  songProgress: number;    // 0.0 to 1.0
  sectionProgress: number; // 0.0 to 1.0
  isLooping: boolean;
  isCountingIn: boolean;
  remainingTimeInSong: number;  // seconds
  remainingTimeInSet: number;   // seconds
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
  channel: number;         // 1-16
  note?: number;           // 0-127
  cc?: number;             // 0-127
  value?: number;          // Specific value or undefined for "any"
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
}

// WebSocket Protocols

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
