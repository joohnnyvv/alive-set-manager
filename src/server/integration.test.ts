import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { WebSocket } from 'ws';
import { startBackendServer } from '../index.js';
import { DemoLive, DemoMidi } from '../testing/demo.js';
import { SettingsStorage } from '../storage/settings.js';

test('real HTTP/WebSocket controls, authentication, persistence and shutdown', async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(),'alive-http-')); t.after(()=>fs.rm(dataDir,{recursive:true,force:true}));
  const settings = new SettingsStorage(dataDir); await settings.updateSetting('authToken','test-secret');
  const live = new DemoLive();
  const options = {dataDir,live,port:0,migrate:false,midiFactory:(a:any,b:any,f:string)=>new DemoMidi(a,b,f)};
  const backend = await startBackendServer(options); t.after(()=>backend.close());
  const base = `http://127.0.0.1:${backend.port}`;
  assert.equal((await fetch(`${base}/api/state`)).status,401);
  const headers = {'x-auth-token':'test-secret','Content-Type':'application/json'};
  const state = await (await fetch(`${base}/api/state`,{headers})).json(); assert.equal(state.setlist.songs.length,4);
  assert.equal(state.liveConnected,true);
  assert.equal((await fetch(`${base}/api/settings`,{method:'POST',headers,body:JSON.stringify({preferredPort:1})})).status,400);
  assert.equal((await fetch(`${base}/api/setlist/load`,{method:'POST',headers,body:'{"name":"missing"}'})).status,404);
  assert.equal((await fetch(`${base}/api/setlist/save`,{method:'POST',headers,body:'{"name":"Rehearsal"}'})).status,200);
  const ws = new WebSocket(`ws://127.0.0.1:${backend.port}/ws?token=test-secret`);
  t.after(()=>ws.terminate());
  await new Promise<void>((resolve,reject)=>{ ws.once('open',resolve); ws.once('error',reject); });
  ws.send(JSON.stringify({type:'play'}));
  await new Promise(r=>setTimeout(r,80)); assert.equal(live.isPlaying(),true);
  ws.send(JSON.stringify({type:'pause'}));
  await new Promise(r=>setTimeout(r,80)); assert.equal(live.isPlaying(),false);
  const rejected = new WebSocket(`ws://127.0.0.1:${backend.port}/ws?token=wrong`);
  await new Promise<void>(resolve=>{ rejected.once('error',()=>resolve()); });
  await backend.close();
  const next = await startBackendServer({...options,live:new DemoLive()});
  try { assert.deepEqual(await (await fetch(`http://127.0.0.1:${next.port}/api/setlist/files`,{headers})).json(),['Rehearsal']); }
  finally { await next.close(); }
});
