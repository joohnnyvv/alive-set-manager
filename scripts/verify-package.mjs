import fs from 'node:fs/promises';
import path from 'node:path';
import { listPackage, extractFile } from '@electron/asar';
async function find(dir, predicate) {
  const result=[];
  for (const item of await fs.readdir(dir,{withFileTypes:true})) {
    const name=path.join(dir,item.name);
    if (predicate(name)) result.push(name);
    else if(item.isDirectory() && !item.name.endsWith('.asar.unpacked')) result.push(...await find(name,predicate));
  }
  return result;
}
const archives=await find('dist-app', p=>p.endsWith('app.asar'));
if(!archives.length) throw new Error('No packaged application found');
for(const archive of archives) {
  const files=listPackage(archive).map(p=>p.replaceAll('\\','/'));
  for(const required of ['/dist/src/electron/main.js','/dist/src/electron/preload.cjs','/frontend/dist/index.html']) if(!files.includes(required)) throw new Error(`Missing ${required}`);
  const forbidden=files.filter(p=>/\/node_modules\/(vite|vite-plugin-solid|lightningcss|caniuse-lite|typescript|@playwright)\//.test(p)||/\.test\.js$/.test(p)||p.endsWith('/testing/server.js'));
  if(forbidden.length) throw new Error(`Development code shipped: ${forbidden.slice(0,10).join(', ')}`);
  const resources=path.dirname(archive);
  for(const file of ['AbletonJS/version.py','AbletonJS/LICENSE','THIRD_PARTY_NOTICES.txt','sbom.json','icon.png']) await fs.access(path.join(resources,file));
  const manifest=JSON.parse(extractFile(archive,'package.json'));
  if(manifest.version !== JSON.parse(await fs.readFile('package.json')).version) throw new Error('Packaged version mismatch');
  const addon=await find(archive+'.unpacked',p=>p.endsWith('.node'));
  if(!addon.length) throw new Error('Native MIDI addon missing');
  console.log(`Verified ${archive}: production contents, resources, notices and ${addon.length} native binaries.`);
}
