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
import { logInfo } from './utils/logger.js';

async function main() {
  console.log('=== Starting Alive Set Manager Backend ===');

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

  // 3. MIDI Action Handler
  const handleMidiAction = async (action: MidiAction) => {
    console.log('[MIDI Action]', action);
    if (wsServer) {
      await wsServer.handleMidiAction(action);
    }
  };

  const midiEngine = new MidiEngine(handleMidiAction, (mappingId, mapping) => {
    if (wsServer) {
      const allMappings = midiEngine.getMappings();
      wsServer.broadcast({ type: 'midi.learned', payload: { mappingId, mapping, mappings: allMappings } });
      wsServer.broadcast({ type: 'midi.mappings', payload: allMappings });
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

  abletonBridge.onIsPlayingChanged((playing) => {
    if (!playing && settingsStorage.getSettings().jumpMode === 'manual' && jumpEngine.getQueuedTarget()) {
      void jumpEngine.executeQueuedNow();
    }
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
    () => playbackTracker.getPlaybackState(),
    midiEngine
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
  let lastHandledSectionActionId: string | null = null;
  let lastHandledTransitionId: string | null = null;
  let transitionScheduleId: string | undefined;
  let loopSectionId: string | null = null;
  let previousPlaybackTime = 0;
  let loopPasses = 0;
  let isTickInFlight = false;

  setInterval(async () => {
    if (isTickInFlight) return;
    isTickInFlight = true;

    try {
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
        const section = active.section;
        if (section?.id !== lastHandledSectionActionId) {
          lastHandledSectionActionId = section?.id || null;
          if (transitionScheduleId) {
            timekeeper.cancelEvent(transitionScheduleId);
            transitionScheduleId = undefined;
          }
          if (section?.id !== lastHandledTransitionId) lastHandledTransitionId = null;
          loopPasses = 0;
          if (section?.flags.pause) {
            await abletonBridge.pause();
          } else if (section?.flags.loop) {
            loopSectionId = section.id;
            await abletonBridge.setLoop(true, section.startTime, section.endTime - section.startTime);
          } else if (loopSectionId) {
            loopSectionId = null;
            await abletonBridge.setLoop(false);
          }
          if (section?.transitionTarget && active.song) {
            const targetSection = active.song.sections.find(candidate => candidate.name.toLowerCase() === section.transitionTarget!.toLowerCase());
            if (targetSection) {
              const sourceSectionId = section.id;
              transitionScheduleId = timekeeper.scheduleAt(Math.max(time, section.endTime - 0.08), async () => {
                if (lastHandledTransitionId === sourceSectionId) return;
                lastHandledTransitionId = sourceSectionId;
                await jumpEngine.executeSectionJump(targetSection);
              });
            }
          }
        }
        if (section?.flags.loop && section.id === loopSectionId && time < previousPlaybackTime - 1) {
          loopPasses++;
          if (section.flags.loopCount && loopPasses >= section.flags.loopCount) {
            loopSectionId = null;
            await abletonBridge.setLoop(false);
          }
        }
        previousPlaybackTime = time;
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

            if (stopBehavior === 'stop' || settings.alwaysStopOnSongEnd || (stopBehavior === 'default' && !settings.autoJumpToNextSong)) {
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
    } catch (err) {
      console.error('[Tick] Error in playback loop:', err);
    } finally {
      isTickInFlight = false;
    }
  }, 50);

  // 7. Start listening on port
  const settings = settingsStorage.getSettings();
  let port = settings.preferredPort || 8080;
  const host = settings.lanMode ? '0.0.0.0' : '127.0.0.1';

  return new Promise<number>((resolve, reject) => {
    const startServerOnPort = (p: number) => {
      const onError = (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`Port ${p} is in use, trying port ${p + 1}...`);
          startServerOnPort(p + 1);
        } else {
          console.error('Server listen error:', err);
          reject(err);
        }
      };

      server.once('error', onError);

      server.listen(p, host, () => {
        server.removeListener('error', onError);
        const ips = getLocalIpAddresses();
        console.log(`\n==================================================`);
        console.log(` Alive Set Manager Server running on port ${p} (${settings.lanMode ? 'LAN Mode' : 'Localhost Only'})`);
        console.log(` Local access: http://localhost:${p}`);
        if (settings.lanMode) {
          ips.forEach(ip => console.log(` Mobile access: http://${ip}:${p}`));
        } else {
          console.log(` (LAN access disabled. Enable in settings for stage mobile access)`);
        }
        console.log(`==================================================\n`);
        resolve(p);
      });
    };

    startServerOnPort(port);
  });
}

export function getLocalIpAddresses(): string[] {
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

export async function startBackendServer(): Promise<number> {
  return main();
}

// Auto-run if executed directly via CLI (tsx or node)
if (process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'))) {
  main().catch(err => {
    console.error('Fatal server startup error:', err);
  });
}
