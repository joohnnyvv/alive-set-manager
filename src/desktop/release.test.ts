import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scriptStatus, installScript } from './script-installer.js';
import { selectUpdate } from './updates.js';
import { SettingsStorage } from '../storage/settings.js';
import { migrateLegacy } from '../storage/migrate.js';

test('script installation is repeatable and preserves modified scripts in backups', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'alive-script-')); t.after(() => fs.rm(dir,{recursive:true,force:true}));
  const source = path.join(dir,'source'), library = path.join(dir,'custom library');
  await fs.mkdir(source); await fs.writeFile(path.join(source,'version.py'), 'version = "4.1.0"');
  assert.equal((await scriptStatus(source,library)).state,'missing');
  assert.equal((await installScript(source,library)).state,'current');
  const target = path.join(library,'Remote Scripts','AbletonJS');
  await fs.mkdir(path.join(target,'__pycache__')); await fs.writeFile(path.join(target,'__pycache__','ignored.pyc'),'cache');
  assert.equal((await installScript(source,library)).state,'current');
  await fs.writeFile(path.join(target,'custom.py'),'user modification');
  await assert.rejects(installScript(source,library), /confirmation/);
  assert.equal(await fs.readFile(path.join(target,'custom.py'),'utf8'),'user modification');
  assert.equal((await installScript(source,library,true)).state,'current');
  const backups = await fs.readdir(path.join(library,'Alive Set Manager Backups'));
  assert.equal(backups.length,1);
  assert.equal(await fs.readFile(path.join(library,'Alive Set Manager Backups',backups[0],'custom.py'),'utf8'),'user modification');
  await assert.rejects(installScript(path.join(dir,'missing'),library,true));
  assert.equal((await scriptStatus(source,library)).state,'current');
});

test('script installer rejects redirected script paths', { skip: process.platform === 'win32' }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'alive-links-')); t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  await fs.mkdir(path.join(dir,'outside')); await fs.mkdir(path.join(dir,'library'));
  await fs.symlink(path.join(dir,'outside'),path.join(dir,'library','Remote Scripts'));
  await assert.rejects(scriptStatus('resources/AbletonJS',path.join(dir,'library')), /symbolic link/);
});

test('updates select semantic versions and exact architecture, never drafts or downgrades', () => {
  const release = (v:string, suffix='mac-arm64.dmg') => ({tag_name:v,body:'notes',assets:[{name:`Alive-Set-Manager-${v}-${suffix}`,browser_download_url:`https://github.com/joohnnyvv/alive-set-manager/releases/download/${v}/installer`}]});
  assert.equal(selectUpdate([release('0.1.0-alpha.10'),release('0.1.0-alpha.2')],'0.1.0-alpha.1','darwin','arm64').version,'0.1.0-alpha.10');
  assert.equal(selectUpdate([{...release('1.0.0'),draft:true}],'0.1.0-alpha.1','darwin','arm64').status,'current');
  assert.equal(selectUpdate([release('0.1.0-alpha.1')],'0.1.0-alpha.2','darwin','arm64').status,'current');
  assert.equal(selectUpdate([release('0.2.0-beta.1')],'0.1.0','darwin','arm64').status,'current');
  assert.equal(selectUpdate([release('0.1.0')],'0.1.0-alpha.1','win32','x64').status,'unavailable');
  assert.equal(selectUpdate([release('0.1.0','win-x64.exe')],'0.1.0-alpha.1','win32','x64').status,'available');
});

test('legacy migration preserves originals, existing destinations, and corrupt data', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'alive-migrate-')); t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const old = path.join(dir,'old'), dest = path.join(dir,'new'); await fs.mkdir(old);
  await fs.writeFile(path.join(old,'settings.json'),JSON.stringify({theme:'live-dark'}));
  await fs.writeFile(path.join(old,'midi-mappings.json'),'broken');
  const warnings = await migrateLegacy(dest,old); assert.deepEqual(warnings,['midi-mappings.json']);
  const storage = new SettingsStorage(dest); await storage.load(); assert.equal(storage.getSettings().theme,'live-dark');
  await storage.updateSetting('theme','soft-dark'); await migrateLegacy(dest,old); await storage.load(); assert.equal(storage.getSettings().theme,'soft-dark');
  assert.equal(await fs.readFile(path.join(old,'midi-mappings.json'),'utf8'),'broken');
  await fs.writeFile(path.join(dest,'settings.json'),'broken'); await assert.rejects(storage.load(),/Original file retained/);
  assert.equal(await fs.readFile(path.join(dest,'settings.json'),'utf8'),'broken');
});
