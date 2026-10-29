import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { ServerEvent, ClientAction, PlaybackState, MidiAction } from '../types/index.js';
import { SetlistEngine } from '../engine/setlist.js';
import type { LiveAdapter } from '../ableton/bridge.js';
import { SettingsStorage } from '../storage/settings.js';
import { SetlistStorage } from '../storage/setlist.js';
import { JumpEngine } from '../engine/jump.js';
import { MidiEngine } from '../midi/engine.js';

import { isOriginAllowed } from './http.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';

export class WsServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(
    server: Server,
    private setlistEngine: SetlistEngine,
    private abletonBridge: LiveAdapter,
    private settingsStorage: SettingsStorage,
    private setlistStorage: SetlistStorage,
    private jumpEngine: JumpEngine,
    private getPlaybackState: () => PlaybackState,
    private midiEngine?: MidiEngine
  ) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      verifyClient: (info, callback) => {
        // 1. Origin verification
        if (!isOriginAllowed(info.origin)) {
          logWarn('WS', `Rejected connection from unauthorized origin: ${info.origin}`);
          callback(false, 403, 'Forbidden origin');
          return;
        }

        // 2. Auth token verification if configured
        const settings = this.settingsStorage.getSettings();
        if (settings.authToken) {
          const reqUrl = new URL(info.req.url || '', `http://${info.req.headers.host || 'localhost'}`);
          const token = reqUrl.searchParams.get('token') || (info.req.headers['x-auth-token'] as string);
          if (token !== settings.authToken) {
            logWarn('WS', `Rejected connection with invalid or missing auth token`);
            callback(false, 401, 'Unauthorized');
            return;
          }
        }

        callback(true);
      },
    });
    this.wss.on('error', error => logError('WS', 'Server error', error));
    this.setupWss();
  }

  private setupWss(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      logInfo('WS', `Client connected. Total clients: ${this.clients.size}`);

      const devices = this.midiEngine ? this.midiEngine.getDevices() : { inputs: [], outputs: [] };

      // Send initial full state snapshot
      this.sendToClient(ws, {
        type: 'state',
        payload: {
          setlist: this.setlistEngine.getSetlistState(
            this.abletonBridge.getTempo(),
            this.abletonBridge.getCurrentSongTime(),
            this.abletonBridge.isPlaying()
          ),
          liveConnected: this.abletonBridge.isConnected?.() ?? false,
        playback: this.getPlaybackState(),
          settings: this.settingsStorage.publicSettings(),
          midi: {
            inputs: devices.inputs,
            outputs: devices.outputs,
            mappings: this.midiEngine ? this.midiEngine.getMappings() : [],
          },
        },
      });

      this.sendToClient(ws, {
        type: 'midi.devices',
        payload: devices,
      });

      if (this.midiEngine) {
        this.sendToClient(ws, {
          type: 'midi.mappings',
          payload: this.midiEngine.getMappings(),
        });
      }

      ws.on('message', async (data: string) => {
        try {
          const action = JSON.parse(data.toString()) as ClientAction;
          await this.handleClientAction(action);
        } catch (err) {
          logError('WS', 'Failed to process message:', err);
          this.sendToClient(ws, {
            type: 'error',
            payload: { message: 'Invalid WebSocket message format', code: 'INVALID_MSG' },
          });
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logInfo('WS', `Client disconnected. Total clients: ${this.clients.size}`);
      });

      ws.on('error', (err) => {
        logError('WS', 'Socket error:', err);
      });
    });
  }

  private async handleClientAction(action: ClientAction): Promise<void> {
    logInfo('WS RX Action', JSON.stringify(action));
    switch (action.type) {
      case 'play':
        await this.abletonBridge.safePlay();
        this.broadcastFullState();
        break;

      case 'pause':
        await this.abletonBridge.pause();
        this.broadcastFullState();
        break;

      case 'stop':
        await this.abletonBridge.safeStop();
        this.broadcastFullState();
        break;

      case 'go':
        await this.handleGoButton();
        this.broadcastFullState();
        break;

      case 'next-song':
        await this.handleNextSong();
        this.broadcastFullState();
        break;

      case 'prev-song':
        await this.handlePrevSong();
        this.broadcastFullState();
        break;

      case 'next-section':
        await this.handleNextSection();
        this.broadcastFullState();
        break;

      case 'prev-section':
        await this.handlePrevSection();
        this.broadcastFullState();
        break;

      case 'jump-to-song':
        await this.jumpEngine.requestSongJump(action.songId);
        this.broadcastFullState();
        break;

      case 'jump-to-section':
        await this.jumpEngine.requestSectionJump(action.sectionId);
        this.broadcastFullState();
        break;

      case 'queue-song':
        await this.jumpEngine.requestSongJump(action.songId);
        this.broadcastFullState();
        break;

      case 'queue-section':
        await this.jumpEngine.requestSectionJump(action.sectionId);
        this.broadcastFullState();
        break;

      case 'cancel-queue':
        this.jumpEngine.cancelQueue();
        this.broadcastFullState();
        break;

      case 'setlist.reorder':
        this.setlistEngine.reorder(action.order);
        this.broadcastUpdatedSetlist();
        break;

      case 'setlist.remove-song':
        this.setlistEngine.removeSong(action.songId);
        this.broadcastUpdatedSetlist();
        break;

      case 'setlist.restore-song':
        this.setlistEngine.restoreSong(action.songId);
        this.broadcastUpdatedSetlist();
        break;

      case 'setlist.duplicate-song':
        this.setlistEngine.duplicateSong(action.songId);
        this.broadcastUpdatedSetlist();
        break;

      case 'setlist.delete-song':
        this.setlistEngine.deleteSong(action.songId);
        this.broadcastUpdatedSetlist();
        break;

      case 'setlist.update-song':
        this.setlistEngine.updateSongOverride(action.songId, action.overrides);
        this.broadcastUpdatedSetlist();
        break;

      case 'setlist.update-section-chords':
        this.setlistEngine.updateSectionChords(action.sectionId, action.chords);
        this.broadcastUpdatedSetlist();
        break;

      case 'setlist.import-text':
        this.setlistEngine.importFromText(action.text);
        this.broadcastUpdatedSetlist();
        break;

      case 'setlist.save':
        const setlistState = this.setlistEngine.getSetlistState();
        await this.setlistStorage.save(action.name, setlistState.order, this.setlistEngine.getSongOverrides(), this.setlistEngine.getSavedDuplicates());
        this.broadcast({ type: 'setlist.saved', payload: { name: action.name } });
        break;

      case 'setlist.load':
        const loaded = await this.setlistStorage.load(action.name);
        if (loaded) {
          this.setlistEngine.restoreSavedSetlist(loaded);
          this.broadcastUpdatedSetlist();
        }
        break;

      case 'settings.set':
        try {
          await this.settingsStorage.updateSetting(action.key as any, action.value);
          this.broadcast({
            type: 'state',
            payload: {
              setlist: this.setlistEngine.getSetlistState(),
              liveConnected: this.abletonBridge.isConnected?.() ?? false,
        playback: this.getPlaybackState(),
              settings: this.settingsStorage.publicSettings(),
            },
          });
        } catch (err: any) {
          logError('WS', `Failed to update setting "${action.key}":`, err);
        }
        break;

      case 'midi.learn':
        if (this.midiEngine) {
          this.midiEngine.startLearn(action.mappingId);
          this.broadcast({ type: 'midi.learning', payload: { mappingId: action.mappingId } });
        }
        break;

      case 'midi.add-mapping':
        if (this.midiEngine) {
          await this.midiEngine.addMapping(action.mapping);
          this.broadcast({ type: 'midi.mappings', payload: this.midiEngine.getMappings() });
        }
        break;

      case 'midi.remove-mapping':
        if (this.midiEngine) {
          await this.midiEngine.removeMapping(action.mappingId);
          this.broadcast({ type: 'midi.mappings', payload: this.midiEngine.getMappings() });
        }
        break;

      case 'midi.update-mapping':
        if (this.midiEngine) {
          await this.midiEngine.updateMapping(action.mapping);
          this.broadcast({ type: 'midi.mappings', payload: this.midiEngine.getMappings() });
        }
        break;

      default:
        console.warn('[WebSocket] Unknown action type:', (action as any).type);
    }
  }

  private getSetlistCurrentState() {
    const tempo = this.abletonBridge.getTempo();
    const time = this.abletonBridge.getCurrentSongTime();
    const isPlaying = this.abletonBridge.isPlaying();
    return this.setlistEngine.getSetlistState(tempo, time, isPlaying);
  }

  public async handleGoButton(): Promise<void> {
    const state = this.getPlaybackState();
    const queued = this.jumpEngine.getQueuedTarget();

    logInfo('GO', `GO Button pressed (isPlaying: ${state.isPlaying}, queued: ${JSON.stringify(queued)}, isLooping: ${state.isLooping})`);

    if (state.isPlaying && queued) {
      logInfo('GO', 'Executing queued jump immediately');
      await this.jumpEngine.executeQueuedNow();
    } else if (state.isPlaying && state.isLooping) {
      logInfo('GO', 'Escaping active loop');
      await this.abletonBridge.setLoop(false);
    } else if (state.isPlaying) {
      logInfo('GO', 'Playing without queue -> Jumping to next song');
      await this.handleNextSong();
    } else if (!state.isPlaying && state.remainingTimeInSong <= 1) {
      logInfo('GO', 'Stopped at song end -> Jumping to next song & playing');
      await this.handleNextSong();
      await this.abletonBridge.safePlay();
    } else {
      logInfo('GO', 'Stopped inside song -> Starting playback');
      await this.abletonBridge.safePlay();
    }
  }

  public async handleNextSong(): Promise<void> {
    const setlist = this.getSetlistCurrentState();
    const activeSongs = setlist.songs.filter(s => !s.isSkipped);
    if (activeSongs.length === 0) return;

    const currentTime = this.abletonBridge.getCurrentSongTime();
    let currentIdx = activeSongs.findIndex(s => s.id === setlist.activeSongId);

    if (currentIdx === -1) {
      for (let i = 0; i < activeSongs.length; i++) {
        if (currentTime >= activeSongs[i].startTime - 0.01 && currentTime < activeSongs[i].endTime - 0.01) {
          currentIdx = i;
          break;
        }
      }
    }

    if (currentIdx === -1) {
      let bestIdx = -1;
      let maxStart = -Infinity;
      for (let i = 0; i < activeSongs.length; i++) {
        if (activeSongs[i].startTime <= currentTime + 0.01 && activeSongs[i].startTime > maxStart) {
          maxStart = activeSongs[i].startTime;
          bestIdx = i;
        }
      }
      currentIdx = bestIdx;
    }

    if (currentIdx !== -1 && currentIdx + 1 < activeSongs.length) {
      const nextSong = activeSongs[currentIdx + 1];
      logInfo('NextSong', `Jumping to next song: "${nextSong.name}" (id: ${nextSong.id})`);
      await this.jumpEngine.requestSongJump(nextSong.id);
    } else if (currentIdx === -1) {
      logInfo('NextSong', `Jumping to first song: "${activeSongs[0].name}"`);
      await this.jumpEngine.requestSongJump(activeSongs[0].id);
    } else {
      logWarn('NextSong', 'Already at last song in setlist');
    }
  }

  public async handlePrevSong(): Promise<void> {
    const setlist = this.getSetlistCurrentState();
    const activeSongs = setlist.songs.filter(s => !s.isSkipped);
    if (activeSongs.length === 0) return;

    const currentTime = this.abletonBridge.getCurrentSongTime();
    const isPlaying = this.abletonBridge.isPlaying();
    const settings = this.settingsStorage.getSettings();

    let currentIdx = activeSongs.findIndex(s => s.id === setlist.activeSongId);

    if (currentIdx === -1) {
      for (let i = 0; i < activeSongs.length; i++) {
        if (currentTime >= activeSongs[i].startTime - 0.01 && currentTime < activeSongs[i].endTime - 0.01) {
          currentIdx = i;
          break;
        }
      }
    }

    if (currentIdx === -1) {
      let bestIdx = -1;
      let maxStart = -Infinity;
      for (let i = 0; i < activeSongs.length; i++) {
        if (activeSongs[i].startTime <= currentTime + 0.01 && activeSongs[i].startTime > maxStart) {
          maxStart = activeSongs[i].startTime;
          bestIdx = i;
        }
      }
      currentIdx = bestIdx;
    }

    if (currentIdx !== -1) {
      const currentSong = activeSongs[currentIdx];
      const elapsedInSong = Math.max(0, currentTime - currentSong.startTime);
      const tempo = setlist.tempo || 120;
      const elapsedSeconds = (elapsedInSong / tempo) * 60;

      if ((isPlaying && elapsedSeconds > 3) || (settings.restartSongBeforeJumpingBack && elapsedSeconds > 1)) {
        logInfo('PrevSong', `Restarting current song "${currentSong.name}"`);
        await this.jumpEngine.requestSongJump(currentSong.id);
      } else if (currentIdx > 0) {
        const prevSong = activeSongs[currentIdx - 1];
        logInfo('PrevSong', `Jumping to previous song: "${prevSong.name}" (id: ${prevSong.id})`);
        await this.jumpEngine.requestSongJump(prevSong.id);
      } else {
        logInfo('PrevSong', `Already at first song -> Restarting "${currentSong.name}"`);
        await this.jumpEngine.requestSongJump(currentSong.id);
      }
    } else {
      logInfo('PrevSong', `Jumping to first song: "${activeSongs[0].name}"`);
      await this.jumpEngine.requestSongJump(activeSongs[0].id);
    }
  }

  public async handleNextSection(): Promise<void> {
    const currentTime = this.abletonBridge.getCurrentSongTime();
    const active = this.setlistEngine.getActiveSongAndSection(currentTime);
    if (!active.song || active.song.sections.length === 0) return;

    const sections = active.song.sections.filter(sec => !sec.flags.skip);
    if (sections.length === 0) return;

    let curIdx = sections.findIndex(sec => sec.id === active.section?.id);

    if (curIdx === -1) {
      for (let i = 0; i < sections.length; i++) {
        if (currentTime >= sections[i].startTime - 0.01 && currentTime < sections[i].endTime - 0.01) {
          curIdx = i;
          break;
        }
      }
    }

    if (curIdx !== -1 && curIdx + 1 < sections.length) {
      logInfo('NextSection', `Jumping to next section: "${sections[curIdx + 1].name}"`);
      await this.jumpEngine.requestSectionJump(sections[curIdx + 1].id);
    } else if (curIdx === -1 && sections.length > 0) {
      logInfo('NextSection', `Jumping to first section: "${sections[0].name}"`);
      await this.jumpEngine.requestSectionJump(sections[0].id);
    }
  }

  public async handlePrevSection(): Promise<void> {
    const currentTime = this.abletonBridge.getCurrentSongTime();
    const active = this.setlistEngine.getActiveSongAndSection(currentTime);
    if (!active.song || active.song.sections.length === 0) return;

    const sections = active.song.sections.filter(sec => !sec.flags.skip);
    if (sections.length === 0) return;

    let curIdx = sections.findIndex(sec => sec.id === active.section?.id);

    if (curIdx === -1) {
      for (let i = 0; i < sections.length; i++) {
        if (currentTime >= sections[i].startTime - 0.01 && currentTime < sections[i].endTime - 0.01) {
          curIdx = i;
          break;
        }
      }
    }

    if (curIdx > 0) {
      logInfo('PrevSection', `Jumping to previous section: "${sections[curIdx - 1].name}"`);
      await this.jumpEngine.requestSectionJump(sections[curIdx - 1].id);
    } else if (sections.length > 0) {
      logInfo('PrevSection', `Already at first section -> Restarting "${sections[0].name}"`);
      await this.jumpEngine.requestSectionJump(sections[0].id);
    }
  }

  public async handleMidiAction(action: MidiAction): Promise<void> {
    logInfo('MIDI', `Executing MIDI Action: ${action.type}`);
    switch (action.type) {
      case 'play':
        await this.abletonBridge.safePlay();
        this.broadcastFullState();
        break;

      case 'pause':
        await this.abletonBridge.pause();
        this.broadcastFullState();
        break;

      case 'stop':
        await this.abletonBridge.safeStop();
        this.broadcastFullState();
        break;

      case 'go':
        await this.handleGoButton();
        this.broadcastFullState();
        break;

      case 'next-song':
        await this.handleNextSong();
        this.broadcastFullState();
        break;

      case 'prev-song':
        await this.handlePrevSong();
        this.broadcastFullState();
        break;

      case 'next-section':
        await this.handleNextSection();
        this.broadcastFullState();
        break;

      case 'prev-section':
        await this.handlePrevSection();
        this.broadcastFullState();
        break;

      case 'toggle-loop':
        const isLoop = (this.getPlaybackState() as any).isLooping;
        await this.abletonBridge.setLoop(!isLoop);
        this.broadcastFullState();
        break;

      case 'cancel-queue':
        this.jumpEngine.cancelQueue();
        this.broadcastFullState();
        break;

      case 'jump-to-song':
        const setlist = this.getSetlistCurrentState();
        const activeSongs = setlist.songs.filter(s => !s.isSkipped);
        const songIdx = (action as any).songIndex;
        if (typeof songIdx === 'number' && songIdx >= 0 && songIdx < activeSongs.length) {
          await this.jumpEngine.requestSongJump(activeSongs[songIdx].id);
        } else if ((action as any).songId) {
          await this.jumpEngine.requestSongJump((action as any).songId);
        }
        this.broadcastFullState();
        break;

      case 'jump-to-section':
        const active = this.setlistEngine.getActiveSongAndSection(this.abletonBridge.getCurrentSongTime());
        const secIdx = (action as any).sectionIndex;
        if (active.song && typeof secIdx === 'number' && secIdx >= 0 && secIdx < active.song.sections.length) {
          await this.jumpEngine.requestSectionJump(active.song.sections[secIdx].id);
        } else if ((action as any).sectionId) {
          await this.jumpEngine.requestSectionJump((action as any).sectionId);
        }
        this.broadcastFullState();
        break;

      default:
        console.warn('[WsServer] Unhandled MIDI action:', (action as any).type);
    }
  }

  public broadcastFullState(): void {
    const devices = this.midiEngine ? this.midiEngine.getDevices() : { inputs: [], outputs: [] };
    this.broadcast({
      type: 'state',
      payload: {
        setlist: this.setlistEngine.getSetlistState(
          this.abletonBridge.getTempo(),
          this.abletonBridge.getCurrentSongTime(),
          this.abletonBridge.isPlaying()
        ),
        liveConnected: this.abletonBridge.isConnected?.() ?? false,
        playback: this.getPlaybackState(),
        settings: this.settingsStorage.publicSettings(),
        midi: {
          inputs: devices.inputs,
          outputs: devices.outputs,
          mappings: this.midiEngine ? this.midiEngine.getMappings() : [],
        },
      },
    });
  }

  public broadcastUpdatedSetlist(): void {
    const state = this.setlistEngine.getSetlistState(
      this.abletonBridge.getTempo(),
      this.abletonBridge.getCurrentSongTime(),
      this.abletonBridge.isPlaying()
    );
    this.broadcast({ type: 'setlist.updated', payload: state });
  }

  public async close(): Promise<void> {
    for (const client of this.clients) client.terminate();
    await new Promise<void>(resolve => this.wss.close(() => resolve()));
  }

  public broadcast(event: ServerEvent): void {
    const payload = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  private sendToClient(ws: WebSocket, event: ServerEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }
}
