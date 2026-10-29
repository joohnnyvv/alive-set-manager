import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const root = process.cwd();
const pkg = JSON.parse(await fs.readFile('package.json'));
const lock = JSON.parse(await fs.readFile('package-lock.json'));
const output = 'resources';
await fs.mkdir(output, { recursive: true });
await fs.mkdir('frontend/public/licenses', { recursive: true });
const components = [];
const notices = ['Alive Set Manager — third-party notices', 'Application license: ISC. Chromium notices are in LICENSES.chromium.html, included with the application and accessible from Help.'];
const allowed = new Set(['MIT','ISC','Apache-2.0','BSD-2-Clause','BSD-3-Clause','0BSD','OFL-1.1','(MIT OR CC0-1.0)']);
const selected = Object.entries(lock.packages).filter(([name, p]) => name && !p.dev);
for (const name of ['@fontsource/dm-sans','@fontsource/dm-mono','@fontsource/dm-serif-display','electron']) {
  const key = `node_modules/${name}`;
  if (!selected.some(([k]) => k === key)) selected.push([key, lock.packages[key]]);
}
for (const [directory, metadata] of selected.sort(([a],[b]) => a.localeCompare(b))) {
  if (!metadata) throw new Error(`Missing locked metadata: ${directory}`);
  if (!allowed.has(metadata.license)) throw new Error(`Unreviewed distributed license: ${directory}: ${metadata.license}`);
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(path.join(directory, 'package.json'))); }
  catch { throw new Error(`Required distribution dependency is not installed: ${directory}`); }
  const names = await fs.readdir(directory);
  const licenseFiles = names.filter(n => /^(licen[sc]e|copying|notice)(\.|$|-)/i.test(n));
  let license = '';
  for (const file of licenseFiles) {
    const target = path.join(directory, file);
    if ((await fs.stat(target)).isFile()) license += `\n${file}\n${await fs.readFile(target, 'utf8')}`;
  }
  if (!license.trim() && manifest.name === 'qrcode-generator') {
    const source = await fs.readFile(path.join(directory, 'qrcode.js'), 'utf8');
    const header = source.slice(0, source.indexOf('var qrcode'));
    if (!header.includes('Licensed under the MIT license')) throw new Error('QR license header changed');
    const mit = await fs.readFile('node_modules/ableton-js/LICENSE', 'utf8');
    license = header + '\n' + mit.replace('Copyright (c) 2022 Leo Bernard', 'Copyright (c) 2009 Kazuhiko Arase');
  }
  if (!license.trim()) throw new Error(`Missing license text: ${directory}`);
  components.push({ type: 'library', name: manifest.name, version: manifest.version, 'bom-ref': `pkg:npm/${manifest.name}@${manifest.version}`, purl: `pkg:npm/${manifest.name}@${manifest.version}`, licenses: [{ license: { id: metadata.license } }], hashes: [{ alg: 'SHA-256', content: createHash('sha256').update(license).digest('hex') }] });
  notices.push(`\n${'='.repeat(72)}\n${manifest.name}@${manifest.version} — ${metadata.license}\n${license}`);
}
const midiHeader = await fs.readFile('node_modules/@julusian/midi/vendor/rtmidi/RtMidi.h', 'utf8');
notices.push('\nRtMidi embedded in @julusian/midi\n' + midiHeader.slice(0, midiHeader.indexOf('*/') + 2));
components.push({ type: 'library', name: 'RtMidi (embedded)', version: 'see @julusian/midi vendor source', licenses: [{license:{id:'MIT'}}] });
const abletonVersion = JSON.parse(await fs.readFile('node_modules/ableton-js/package.json')).version;
await fs.rm(path.join(output, 'AbletonJS'), { recursive: true, force: true });
await fs.cp('node_modules/ableton-js/midi-script', path.join(output, 'AbletonJS'), { recursive: true, filter: p => !p.includes('__pycache__') && !p.endsWith('.pyc') });
await fs.copyFile('node_modules/ableton-js/LICENSE', path.join(output, 'AbletonJS/LICENSE'));
if (!(await fs.readFile(path.join(output, 'AbletonJS/version.py'), 'utf8')).includes(`"${abletonVersion}"`)) throw new Error('AbletonJS package/script version mismatch');
notices.push(`\nAbletonJS Remote Script ${abletonVersion}: covered by the ableton-js MIT notice above.\n`);
await fs.writeFile(path.join(output, 'THIRD_PARTY_NOTICES.txt'), notices.join('\n'));
await fs.writeFile(path.join(output, 'sbom.json'), JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1, metadata: { component: { type: 'application', name: pkg.name, version: pkg.version } }, components }, null, 2));
await fs.copyFile('node_modules/electron/dist/LICENSES.chromium.html', path.join(output, 'LICENSES.chromium.html'));
await fs.copyFile(path.join(output, 'THIRD_PARTY_NOTICES.txt'), 'frontend/public/licenses/THIRD_PARTY_NOTICES.txt');
await fs.copyFile(path.join(output, 'LICENSES.chromium.html'), 'frontend/public/licenses/LICENSES.chromium.html');
const svg = await fs.readFile('resources/icon.svg');
const pngs = new Map();
for (const size of [16,32,48,64,128,180,256,512,1024]) pngs.set(size, await sharp(svg).resize(size,size).png().toBuffer());
await fs.writeFile('resources/icon.png', pngs.get(1024));
await fs.writeFile('frontend/public/favicon.png', pngs.get(32));
await fs.writeFile('frontend/public/apple-touch-icon.png', pngs.get(180));
const sizes = [16,32,48,256];
const icoHeader = Buffer.alloc(6 + 16 * sizes.length); icoHeader.writeUInt16LE(1,2); icoHeader.writeUInt16LE(sizes.length,4);
let offset = icoHeader.length;
sizes.forEach((size,i) => { const o = 6+i*16; icoHeader[o] = size%256; icoHeader[o+1] = size%256; icoHeader.writeUInt16LE(1,o+4); icoHeader.writeUInt16LE(32,o+6); icoHeader.writeUInt32LE(pngs.get(size).length,o+8); icoHeader.writeUInt32LE(offset,o+12); offset += pngs.get(size).length; });
await fs.writeFile('resources/icon.ico', Buffer.concat([icoHeader,...sizes.map(s=>pngs.get(s))]));
const chunks = [[128,'ic07'],[256,'ic08'],[512,'ic09'],[1024,'ic10']].map(([size,type])=> { const h=Buffer.alloc(8);h.write(type);h.writeUInt32BE(8+pngs.get(size).length,4);return Buffer.concat([h,pngs.get(size)]); });
const h=Buffer.alloc(8); h.write('icns');h.writeUInt32BE(8+chunks.reduce((s,c)=>s+c.length,0),4);
await fs.writeFile('resources/icon.icns',Buffer.concat([h,...chunks]));
console.log(`Prepared icons, offline licenses, ${components.length} SBOM components, and AbletonJS ${abletonVersion}.`);
