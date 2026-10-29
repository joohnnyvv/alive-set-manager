import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { startBackendServer } from '../index.js';
import { DemoLive, DemoMidi, demoCues } from './demo.js';
const dataDir = await mkdtemp(path.join(tmpdir(), 'alive-demo-'));
const live = new DemoLive();
let midi: DemoMidi;
const backend = await startBackendServer({ live, dataDir, port: Number(process.env.PORT || 4173), migrate: false, midiFactory: (a,b,f) => (midi = new DemoMidi(a,b,f)) });
// Test-only control server. Not included in release packages, never binds to LAN.
const control = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.headers.origin) { res.writeHead(403).end(); return; }
  let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 1024) { res.writeHead(413).end(); return; } }
  try {
    const command = JSON.parse(body);
    if (command.type === 'connection') live.setConnected(!!command.value);
    if (command.type === 'empty') live.setCues(command.value ? [] : demoCues);
    if (command.type === 'advance') live.advance(Number(command.beats) || 0);
    if (command.type === 'midi') midi!.emitNote(command.note);
    res.end('{}');
  } catch { res.writeHead(400).end(); }
});
control.listen(4174, '127.0.0.1');
console.log(`Demo ready at http://127.0.0.1:${backend.port}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => { control.close(); await backend.close(); await rm(dataDir, { recursive: true, force: true }); process.exit(); });
