import http from 'http';
import os from 'os';
import { AbletonBridge } from './ableton/bridge.js';
import { SetlistEngine } from './engine/setlist.js';
import { SettingsStorage } from './storage/settings.js';
import { SetlistStorage } from './storage/setlist.js';
import { Timekeeper } from './engine/timekeeper.js';
import { JumpEngine } from './engine/jump.js';
import { PlaybackTracker } from './engine/playback.js';
import { MidiEngine } from './midi/engine.js';
import { createHttpServer } from './server/http.js';
import { WsServer } from './server/websocket.js';
import { MidiAction } from './types/index.js';
import { logInfo, logWarn, logError } from './utils/logger.js';

async function main() {
  console.log('=== Starting AbleSet Controller Backend ===');

  // 1. Storage
  const settingsStorage = new SettingsStorage();
  await settingsStorage.load();

  const setlistStorage = new SetlistStorage();

  // 2. Ableton & Engines
  const abletonBridge = new AbletonBridge();
  const setlistEngine = new SetlistEngine();
  const timekeeper = new Timekeeper();

  let wsServer: WsServer;

  const jumpEngine = new JumpEngine(
    setlistEngine,
    abletonBridge,
    timekeeper,
    settingsStorage,
    (queuedSongId, queuedSectionId) => {
      if (wsServer) {
        wsServer.broadcast({
          type: 'playback.queued',
          payload: { songId: queuedSongId, sectionId: queuedSectionId },
        });
      }
    }
  );

  const playbackTracker = new PlaybackTracker(
    abletonBridge,
    setlistEngine,
    (songId, prevId) => {
      if (wsServer) {
        wsServer.broadcast({ type: 'playback.songChanged', payload: { songId, previousSongId: prevId } });
      }
    },
    (sectionId, prevId) => {
      if (wsServer) {
        wsServer.broadcast({ type: 'playback.sectionChanged', payload: { sectionId, previousSectionId: prevId } });
      }
    }
  );

  // 3. MIDI Action Handler (including GO button logic)
  const handleMidiAction = async (action: MidiAction) => {
    console.log('[MIDI Action]', action);
    switch (action.type) {
      case 'play':
        await abletonBridge.safePlay();
        break;
      case 'pause':
        await abletonBridge.pause();
        break;
      case 'stop':
        await abletonBridge.safeStop();
        break;
      case 'cancel-queue':
        jumpEngine.cancelQueue();
        break;
      case 'toggle-loop':
        const isLoop = (playbackTracker.getPlaybackState() as any).isLooping;
        await abletonBridge.setLoop(!isLoop);
        break;
      case 'go':
        await handleGoButton();
        break;
      case 'next-song':
        const setlistNext = setlistEngine.getSetlistState();
        if (setlistNext.activeSongId) {
          const idx = setlistNext.songs.findIndex(s => s.id === setlistNext.activeSongId);
          if (idx !== -1 && idx + 1 < setlistNext.songs.length) {
            await jumpEngine.requestSongJump(setlistNext.songs[idx + 1].id);
          }
        }
        break;
      case 'prev-song':
        const setlistPrev = setlistEngine.getSetlistState();
        if (setlistPrev.activeSongId) {
          const idx = setlistPrev.songs.findIndex(s => s.id === setlistPrev.activeSongId);
          if (idx > 0) {
            await jumpEngine.requestSongJump(setlistPrev.songs[idx - 1].id);
          }
        }
        break;
    }
  };

  const handleGoButton = async () => {
    const state = playbackTracker.getPlaybackState();
    const queued = jumpEngine.getQueuedTarget();

    if (state.isPlaying && queued) {
      // 1. Playing with queued jump -> execute immediately
      await jumpEngine.executeQueuedNow();
    } else if (state.isPlaying && state.isLooping) {
      // 2. Playing in loop -> escape loop
      await abletonBridge.setLoop(false);
    } else if (!state.isPlaying && state.remainingTimeInSong <= 1) {
      // 3. Stopped at song end -> next song
      const setlist = setlistEngine.getSetlistState();
      if (setlist.activeSongId) {
        const idx = setlist.songs.findIndex(s => s.id === setlist.activeSongId);
        if (idx !== -1 && idx + 1 < setlist.songs.length) {
          await jumpEngine.requestSongJump(setlist.songs[idx + 1].id);
        }
      }
    } else if (!state.isPlaying) {
      // 4. Stopped inside song -> start playback
      await abletonBridge.safePlay();
    }
  };

  const midiEngine = new MidiEngine(handleMidiAction, (mappingId, mapping) => {
    if (wsServer) {
      wsServer.broadcast({ type: 'midi.learned', payload: { mappingId, mapping } });
    }
  });

  await midiEngine.init();

  // 4. Connect Ableton Bridge & Start Timekeeper
  await abletonBridge.start();
  timekeeper.start();

  // Update setlist when cue points change
  const initialCues = abletonBridge.getRawCuePoints();
  setlistEngine.buildSetlistFromCues(initialCues, abletonBridge.getTempo());

  abletonBridge.onCuePointsChanged((cues) => {
    setlistEngine.buildSetlistFromCues(cues, abletonBridge.getTempo());
    if (wsServer) {
      wsServer.broadcastUpdatedSetlist();
    }
  });

  abletonBridge.onIsPlayingChanged(() => {
    if (wsServer) {
      wsServer.broadcastFullState();
    }
  });

  // 5. Create Express & WebSocket Server
  const app = createHttpServer(
    setlistEngine,
    abletonBridge,
    settingsStorage,
    setlistStorage,
    () => playbackTracker.getPlaybackState()
  );

  const server = http.createServer(app);

  wsServer = new WsServer(
    server,
    setlistEngine,
    abletonBridge,
    settingsStorage,
    setlistStorage,
    jumpEngine,
    () => playbackTracker.getPlaybackState(),
    midiEngine
  );

  // 6. Ticker loop (~20 times/sec when playing) for playback ticks and song-end monitoring
  let lastHandledSongEndId: string | null = null;

  setInterval(async () => {
    const time = abletonBridge.getCurrentSongTime();
    const tempo = abletonBridge.getTempo();
    timekeeper.updateTime(time, tempo);

    if (abletonBridge.isPlaying()) {
      const state = playbackTracker.getPlaybackState();
      wsServer.broadcast({
        type: 'playback.tick',
        payload: {
          currentTime: state.currentTime,
          isPlaying: state.isPlaying,
          tempo: state.tempo,
          songProgress: state.songProgress,
          sectionProgress: state.sectionProgress,
          remainingTimeInSong: state.remainingTimeInSong,
        },
      });

      // Song end boundary detection & auto-jump/stop behavior
      const active = setlistEngine.getActiveSongAndSection(time);
      if (active.song) {
        if (lastHandledSongEndId === active.song.id && time < active.song.endTime - 2) {
          // Reset handled guard if user jumped back earlier into song
          lastHandledSongEndId = null;
        }

        if (time >= active.song.endTime - 0.2 && lastHandledSongEndId !== active.song.id) {
          lastHandledSongEndId = active.song.id;
          const settings = settingsStorage.getSettings();
          const stopBehavior = active.song.stopBehavior || 'default';
          logInfo('SongEnd', `Song "${active.song.name}" reached end at beat ${time.toFixed(2)} (stopBehavior: ${stopBehavior})`);

          if (stopBehavior === 'stop' || settings.alwaysStopOnSongEnd) {
            logInfo('SongEnd', `Action: Stopping playback`);
            await abletonBridge.safeStop();
          } else if (stopBehavior === 'pause') {
            logInfo('SongEnd', `Action: Pausing playback`);
            await abletonBridge.pause();
          } else {
            const setlist = setlistEngine.getSetlistState();
            const activeIdx = setlist.songs.findIndex(s => s.id === active.song!.id);
            const nextSong = setlist.songs.slice(activeIdx + 1).find(s => !s.isSkipped);

            if (nextSong) {
              logInfo('SongEnd', `Action: Auto-jumping to next song "${nextSong.name}"`);
              await jumpEngine.executeSongJump(nextSong);
            } else {
              logInfo('SongEnd', `Action: End of setlist reached. Stopping playback`);
              await abletonBridge.safeStop();
            }
          }
        }
      }
    }
  }, 50);

  // 7. Start listening on port
  const settings = settingsStorage.getSettings();
  let port = settings.preferredPort || 8080;

  const startServerOnPort = (p: number) => {
    server.listen(p, () => {
      const ips = getLocalIpAddresses();
      console.log(`\n==================================================`);
      console.log(` AbleSet Controller Server running on port ${p}`);
      console.log(` Local access: http://localhost:${p}`);
      ips.forEach(ip => console.log(` Mobile access: http://${ip}:${p}`));
      console.log(`==================================================\n`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`Port ${p} is in use, trying port ${p + 1}...`);
        startServerOnPort(p + 1);
      } else {
        console.error('Server listen error:', err);
      }
    });
  };

  startServerOnPort(port);
}

function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

main().catch(err => {
  console.error('Fatal server startup error:', err);
});
