import type { LiveAdapter, RawCuePoint } from '../ableton/bridge.js';
import { MidiEngine } from '../midi/engine.js';
import { EventEmitter } from 'node:events';

export const demoCues: RawCuePoint[] = [
  ['Northern Lights {Key: F#m} [blue]', 0], ['> Intro {F#m D A E}', 0.01], ['>> Chorus {F#m D A E}', 32], ['> Bridge {D A E F#m} +LOOP:2', 96], ['> Outro {D E F#m}', 128], ['SONG END', 160],
  ['Paper Satellites {Key: C} [orange]', 176], ['> Intro {C G Am F}', 176.01], ['>> Chorus {C G Am F}', 208], ['> Outro {F G C}', 272], ['STOP', 304],
  ['After the Rain {Key: D} [green]', 320], ['> Verse {D A Bm G}', 320.01], ['>> Chorus {G D A Bm}', 368], ['> Outro {G A D}', 432], ['SONG END', 464],
  ['Open Water {Key: Am} [purple]', 480], ['> Verse {Am F C G}', 480.01], ['>> Chorus {F C G Am}', 528], ['> Outro {F G Am}', 592], ['STOP', 624],
].map(([name, time], index) => ({ id: `demo-${index}`, name: String(name), time: Number(time) }));

export class DemoLive implements LiveAdapter {
  private connected = true;
  private playing = false;
  private looping = false;
  private time = 48;
  private loopStart = 0;
  private loopLength = 16;
  private cues = demoCues.map(c => ({ ...c }));
  private cueListeners: ((cues: RawCuePoint[]) => void)[] = [];
  private playListeners: ((playing: boolean) => void)[] = [];
  async start() {}
  async close() { this.cueListeners = []; this.playListeners = []; }
  isConnected() { return this.connected; }
  isPlaying() { return this.connected && this.playing; }
  isLooping() { return this.looping; }
  getCurrentSongTime() { return this.time; }
  getTempo() { return 128; }
  getRawCuePoints() { return this.cues; }
  onCuePointsChanged(cb: (cues: RawCuePoint[]) => void) { this.cueListeners.push(cb); }
  onIsPlayingChanged(cb: (playing: boolean) => void) { this.playListeners.push(cb); }
  async safePlay() { if (this.connected) { this.playing = true; this.playListeners.forEach(cb => cb(true)); } }
  async safeStop() { this.playing = false; this.playListeners.forEach(cb => cb(false)); }
  async pause() { await this.safeStop(); }
  async setSongTime(time: number) { this.time = time; }
  async jumpToTime(time: number) { this.time = time; }
  async jumpToCue(id: string) { const cue = this.cues.find(c => c.id === id); if (cue) this.time = cue.time; }
  async setLoop(enabled: boolean, start?: number, length?: number) { this.looping = enabled; this.loopStart = start ?? this.loopStart; this.loopLength = length ?? this.loopLength; }
  setConnected(value: boolean) { this.connected = value; }
  setCues(cues: RawCuePoint[]) { this.cues = cues; this.cueListeners.forEach(cb => cb(cues)); }
  advance(beats: number) { if (!this.isPlaying()) return; this.time += beats; if (this.looping && this.time >= this.loopStart + this.loopLength) this.time = this.loopStart + (this.time - this.loopStart) % this.loopLength; }
}

export class DemoMidi extends MidiEngine {
  available = true;
  private input = new EventEmitter();
  override getDevices() { return { inputs: this.available ? ['Demo Pedal'] : [], outputs: [] }; }
  override refreshDevices() {}
  override async init() { await this.loadMappings(); (this as any).setupInputListeners('Demo Pedal', this.input); }
  emitNote(note = 60) { if (this.available) this.input.emit('noteon', { note, velocity: 100, channel: 0 }); }
  override close() { this.input.removeAllListeners(); }
}
