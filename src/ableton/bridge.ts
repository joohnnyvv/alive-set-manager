import { Ableton } from 'ableton-js';
import { ParsedLocator } from '../types/index.js';
import { parseLocator } from '../parsers/locator.js';
import { logInfo, logWarn, logError } from '../utils/logger.js';

export interface RawCuePoint {
  id: string;
  name: string;
  time: number;
}

export class AbletonBridge {
  public ableton: Ableton;
  private isConnectedState = false;
  private isPlayingState = false;
  private isLoopingState = false;
  private currentSongTimeState = 0;
  private tempoState = 120;
  private rawCuePoints: RawCuePoint[] = [];
  private listenersAttached = false;
  private cuePointCallbacks: ((cues: RawCuePoint[]) => void)[] = [];
  private isPlayingCallbacks: ((playing: boolean) => void)[] = [];
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.ableton = new Ableton();
    this.setupConnectionEvents();
    this.startHealthCheck();
  }

  public async start(): Promise<void> {
    try {
      await this.ableton.start(2000);
      this.isConnectedState = true;
      logInfo('AbletonBridge', 'Connected to Ableton Live.');
      await this.setupListeners();
      await this.refreshState();
    } catch (err) {
      logWarn('AbletonBridge', 'Ableton Live not detected on startup. Auto-retry health check active...');
      this.isConnectedState = false;
    }
  }

  private setupConnectionEvents(): void {
    this.ableton.on('connect', async () => {
      logInfo('AbletonBridge', 'Event: connect to Ableton Live');
      this.isConnectedState = true;
      await this.setupListeners();
      await this.refreshState();
    });

    this.ableton.on('disconnect', () => {
      logWarn('AbletonBridge', 'Event: disconnect from Ableton Live');
      this.isConnectedState = false;
      this.listenersAttached = false;
    });
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) return;
    this.healthCheckInterval = setInterval(async () => {
      try {
        const playing = await this.ableton.song.get('is_playing');
        const time = await this.ableton.song.get('current_song_time');
        const tempo = await this.ableton.song.get('tempo');
        const looping = await this.ableton.song.get('loop');

        if (!this.isConnectedState) {
          logInfo('AbletonBridge', 'Auto-detected active Ableton Live session!');
          this.isConnectedState = true;
          await this.setupListeners();
          await this.fetchCuePoints();
        }

        const wasPlaying = this.isPlayingState;
        this.isPlayingState = playing;
        this.currentSongTimeState = time;
        this.tempoState = tempo;
        this.isLoopingState = !!looping;

        if (wasPlaying !== playing) {
          console.log(`[AbletonBridge] State sync: is_playing changed to ${playing}`);
          for (const cb of this.isPlayingCallbacks) {
            cb(playing);
          }
        }
      } catch (err) {
        if (this.isConnectedState) {
          console.warn('[AbletonBridge] Health check query failed. Ableton may be closed or unready.');
          this.isConnectedState = false;
        }
      }
    }, 1000);
  }

  private async setupListeners(): Promise<void> {
    if (this.listenersAttached) return;
    try {
      this.listenersAttached = true;

      this.ableton.song.addListener('is_playing', (playing: boolean) => {
        console.log(`[AbletonBridge] UDP Event: is_playing changed to ${playing}`);
        const was = this.isPlayingState;
        this.isPlayingState = playing;
        if (was !== playing) {
          for (const cb of this.isPlayingCallbacks) {
            cb(playing);
          }
        }
      });

      this.ableton.song.addListener('current_song_time', (time: number) => {
        this.currentSongTimeState = time;
      });

      this.ableton.song.addListener('tempo', (tempo: number) => {
        this.tempoState = tempo;
      });

      this.ableton.song.addListener('cue_points', async () => {
        const cues = await this.fetchCuePoints();
        for (const cb of this.cuePointCallbacks) {
          cb(cues);
        }
      });
    } catch (err) {
      console.error('[AbletonBridge] Error setting up listeners:', err);
      this.listenersAttached = false;
    }
  }

  public onCuePointsChanged(callback: (cues: RawCuePoint[]) => void): void {
    this.cuePointCallbacks.push(callback);
  }

  public onIsPlayingChanged(callback: (playing: boolean) => void): void {
    this.isPlayingCallbacks.push(callback);
  }

  public async refreshState(): Promise<void> {
    if (!this.isConnectedState) return;
    try {
      this.isPlayingState = await this.ableton.song.get('is_playing');
      this.currentSongTimeState = await this.ableton.song.get('current_song_time');
      this.tempoState = await this.ableton.song.get('tempo');
      await this.fetchCuePoints();
    } catch (err) {
      console.error('[AbletonBridge] Error refreshing state:', err);
    }
  }

  public async fetchCuePoints(): Promise<RawCuePoint[]> {
    if (!this.isConnectedState) return this.rawCuePoints;
    try {
      const cues = await this.ableton.song.get('cue_points');
      const cueList: RawCuePoint[] = [];
      for (const cue of cues) {
        const name = await cue.get('name');
        const time = await cue.get('time');
        cueList.push({
          id: cue.raw.id,
          name,
          time,
        });
      }
      this.rawCuePoints = cueList;
      return cueList;
    } catch (err) {
      console.error('[AbletonBridge] Error fetching cue points:', err);
      return this.rawCuePoints;
    }
  }

  public getRawCuePoints(): RawCuePoint[] {
    return this.rawCuePoints;
  }

  public isConnected(): boolean {
    return this.isConnectedState;
  }

  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  public getCurrentSongTime(): number {
    return this.currentSongTimeState;
  }

  public getTempo(): number {
    return this.tempoState;
  }

  public isLooping(): boolean {
    return this.isLoopingState;
  }

  /**
   * ⭐ CRITICAL: Always use safeStartPlaying() to prevent arrangement jump to start bug.
   */
  public async safePlay(): Promise<void> {
    if (!this.isConnectedState) {
      console.warn('[AbletonBridge] safePlay ignored: Ableton Live is not connected.');
      return;
    }
    try {
      console.log('[AbletonBridge] ▶ Action: safePlay()');
      await this.ableton.song.safeStartPlaying();
      this.isPlayingState = true;
      for (const cb of this.isPlayingCallbacks) {
        cb(true);
      }
    } catch (err) {
      console.error('[AbletonBridge] Error in safePlay:', err);
    }
  }

  /**
   * ⭐ CRITICAL: Always use safeStopPlaying() to prevent arrangement jump to start bug.
   */
  public async safeStop(): Promise<void> {
    if (!this.isConnectedState) {
      console.warn('[AbletonBridge] safeStop ignored: Ableton Live is not connected.');
      return;
    }
    try {
      console.log('[AbletonBridge] ⏹ Action: safeStop()');
      await this.ableton.song.safeStopPlaying();
      this.isPlayingState = false;
      for (const cb of this.isPlayingCallbacks) {
        cb(false);
      }
    } catch (err) {
      console.error('[AbletonBridge] Error in safeStop:', err);
    }
  }

  public async pause(): Promise<void> {
    console.log('[AbletonBridge] ⏸ Action: pause()');
    await this.safeStop();
  }

  public async setSongTime(beatTime: number): Promise<void> {
    if (!this.isConnectedState) return;
    try {
      await this.ableton.song.set('current_song_time', beatTime);
      this.currentSongTimeState = beatTime;
    } catch (err) {
      console.error('[AbletonBridge] Error setting song time:', err);
    }
  }

  public async jumpToCue(cueId: string): Promise<void> {
    if (!this.isConnectedState) return;
    try {
      const cues = await this.ableton.song.get('cue_points');
      const targetCue = cues.find(c => String(c.raw.id) === String(cueId) || c.raw.name === cueId);
      if (targetCue) {
        console.log(`[AbletonBridge] Jumping to cue: ${targetCue.raw.name} (id: ${targetCue.raw.id})`);
        await targetCue.jump();
        const cueTime = await targetCue.get('time');
        this.currentSongTimeState = cueTime;
      } else {
        console.warn(`[AbletonBridge] Cue point ${cueId} not found`);
      }
    } catch (err) {
      console.error('[AbletonBridge] Error jumping to cue:', err);
    }
  }

  public async jumpToTime(beatTime: number): Promise<void> {
    if (!this.isConnectedState) return;
    try {
      const cues = await this.ableton.song.get('cue_points');
      let closestCue = cues[0];
      let minDiff = Infinity;
      for (const cue of cues) {
        const time = await cue.get('time');
        const diff = Math.abs(time - beatTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestCue = cue;
        }
      }
      if (closestCue && minDiff < 0.1) {
        await closestCue.jump();
      } else {
        await this.setSongTime(beatTime);
      }
      this.currentSongTimeState = beatTime;
    } catch (err) {
      console.error('[AbletonBridge] Error jumping to time:', err);
      await this.setSongTime(beatTime);
      this.currentSongTimeState = beatTime;
    }
  }

  public async setLoop(enabled: boolean, startBeats?: number, lengthBeats?: number): Promise<void> {
    if (!this.isConnectedState) return;
    try {
      if (startBeats !== undefined) {
        await this.ableton.song.set('loop_start', startBeats);
      }
      if (lengthBeats !== undefined) {
        await this.ableton.song.set('loop_length', lengthBeats);
      }
      await this.ableton.song.set('loop', enabled);
      this.isLoopingState = enabled;
    } catch (err) {
      console.error('[AbletonBridge] Error setting loop state:', err);
    }
  }
}
