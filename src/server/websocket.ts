import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { ServerEvent, ClientAction, PlaybackState } from '../types/index.js';
import { SetlistEngine } from '../engine/setlist.js';
import { AbletonBridge } from '../ableton/bridge.js';
import { SettingsStorage } from '../storage/settings.js';
import { SetlistStorage } from '../storage/setlist.js';
import { JumpEngine } from '../engine/jump.js';
import { MidiEngine } from '../midi/engine.js';

import { logInfo, logError, logWarn } from '../utils/logger.js';

export class WsServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(
    server: Server,
    private setlistEngine: SetlistEngine,
    private abletonBridge: AbletonBridge,
    private settingsStorage: SettingsStorage,
    private setlistStorage: SetlistStorage,
    private jumpEngine: JumpEngine,
    private getPlaybackState: () => PlaybackState,
    private midiEngine?: MidiEngine
  ) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
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
          playback: this.getPlaybackState(),
          settings: this.settingsStorage.getSettings(),
        },
      });

      this.sendToClient(ws, {
        type: 'midi.devices',
        payload: devices,
      });

      ws.on('message', async (data: string) => {
        try {
          const action = JSON.parse(data.toString()) as ClientAction;
          await this.handleClientAction(ws, action);
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

  private async handleClientAction(ws: WebSocket, action: ClientAction): Promise<void> {
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

      case 'setlist.update-song':
        this.setlistEngine.updateSongOverride(action.songId, action.overrides);
        this.broadcastUpdatedSetlist();
        break;

      case 'setlist.import-text':
        this.setlistEngine.importFromText(action.text);
        this.broadcastUpdatedSetlist();
        break;

      case 'setlist.save':
        const setlistState = this.setlistEngine.getSetlistState();
        await this.setlistStorage.save(action.name, setlistState.order);
        this.broadcast({ type: 'setlist.saved', payload: { name: action.name } });
        break;

      case 'setlist.load':
        const loaded = await this.setlistStorage.load(action.name);
        if (loaded) {
          this.setlistEngine.reorder(loaded.order);
          this.broadcastUpdatedSetlist();
        }
        break;

      case 'settings.set':
        await this.settingsStorage.updateSetting(action.key as any, action.value);
        this.broadcast({
          type: 'state',
          payload: {
            setlist: this.setlistEngine.getSetlistState(),
            playback: this.getPlaybackState(),
            settings: this.settingsStorage.getSettings(),
          },
        });
        break;

      case 'midi.learn':
        if (this.midiEngine) {
          this.midiEngine.startLearn(action.mappingId);
          this.broadcast({ type: 'midi.learning', payload: { mappingId: action.mappingId } });
        }
        break;

      case 'midi.add-mapping':
        if (this.midiEngine) {
          this.midiEngine.addMapping(action.mapping);
        }
        break;

      case 'midi.remove-mapping':
        if (this.midiEngine) {
          this.midiEngine.removeMapping(action.mappingId);
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

  private async handleGoButton(): Promise<void> {
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
      logInfo('GO', 'Stopped at song end -> Jumping to next song');
      await this.handleNextSong();
    } else {
      logInfo('GO', 'Stopped inside song -> Starting playback');
      await this.abletonBridge.safePlay();
    }
  }

  private async handleNextSong(): Promise<void> {
    const setlist = this.getSetlistCurrentState();
    const activeSongs = setlist.songs.filter(s => !s.isSkipped);
    const currentTime = this.abletonBridge.getCurrentSongTime();

    let currentIdx = activeSongs.findIndex(s => s.id === setlist.activeSongId);

    if (currentIdx === -1 && activeSongs.length > 0) {
      for (let i = 0; i < activeSongs.length; i++) {
        if (currentTime < activeSongs[i].endTime) {
          currentIdx = i - 1;
          break;
        }
      }
      if (currentIdx === -1 && currentTime >= activeSongs[activeSongs.length - 1].endTime) {
        currentIdx = activeSongs.length - 1;
      }
    }

    if (currentIdx !== -1 && currentIdx + 1 < activeSongs.length) {
      logInfo('NextSong', `Jumping to next song: "${activeSongs[currentIdx + 1].name}" (id: ${activeSongs[currentIdx + 1].id})`);
      await this.jumpEngine.requestSongJump(activeSongs[currentIdx + 1].id);
    } else if (currentIdx === -1 && activeSongs.length > 0) {
      logInfo('NextSong', `Jumping to first song: "${activeSongs[0].name}"`);
      await this.jumpEngine.requestSongJump(activeSongs[0].id);
    } else {
      logWarn('NextSong', 'Already at last song in setlist');
    }
  }

  private async handlePrevSong(): Promise<void> {
    const setlist = this.getSetlistCurrentState();
    const activeSongs = setlist.songs.filter(s => !s.isSkipped);
    const currentTime = this.abletonBridge.getCurrentSongTime();

    let currentIdx = activeSongs.findIndex(s => s.id === setlist.activeSongId);

    if (currentIdx === -1 && activeSongs.length > 0) {
      for (let i = 0; i < activeSongs.length; i++) {
        if (currentTime <= activeSongs[i].endTime) {
          currentIdx = i;
          break;
        }
      }
    }

    if (currentIdx > 0) {
      logInfo('PrevSong', `Jumping to previous song: "${activeSongs[currentIdx - 1].name}" (id: ${activeSongs[currentIdx - 1].id})`);
      await this.jumpEngine.requestSongJump(activeSongs[currentIdx - 1].id);
    } else if (currentIdx === 0) {
      logInfo('PrevSong', `Already at first song -> Restarting "${activeSongs[0].name}"`);
      await this.jumpEngine.requestSongJump(activeSongs[0].id);
    } else if (activeSongs.length > 0) {
      logInfo('PrevSong', `Jumping to first song: "${activeSongs[0].name}"`);
      await this.jumpEngine.requestSongJump(activeSongs[0].id);
    }
  }

  public broadcastFullState(): void {
    this.broadcast({
      type: 'state',
      payload: {
        setlist: this.setlistEngine.getSetlistState(
          this.abletonBridge.getTempo(),
          this.abletonBridge.getCurrentSongTime(),
          this.abletonBridge.isPlaying()
        ),
        playback: this.getPlaybackState(),
        settings: this.settingsStorage.getSettings(),
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
