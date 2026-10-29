import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const pkg=JSON.parse(await fs.readFile('package.json'));
const tag=process.env.GITHUB_REF_NAME || `v${pkg.version}`;
if(tag!==`v${pkg.version}` || !/^v\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/.test(tag)) throw new Error('Tag must match the package version');
const changelog=await fs.readFile('CHANGELOG.md','utf8');
const section=changelog.split(`## [${pkg.version}]`)[1]?.split('\n## ')[0];
if(!section) throw new Error('Version has no changelog entry');
if(process.argv[2]==='validate') {
  execFileSync('git',['merge-base','--is-ancestor','HEAD','origin/master']);
  console.log(`Validated ${tag} on master`);
} else if(process.argv[2]==='assemble') {
  const dir='release-assets'; await fs.mkdir(dir,{recursive:true});
  const names=(await fs.readdir(dir)).filter(n=>/\.(dmg|zip|exe|json|txt)$/.test(n) && n!=='SHA256SUMS.txt');
  for(const suffix of ['mac-arm64.dmg','mac-arm64.zip','mac-x64.dmg','mac-x64.zip','win-x64.exe']) if(!names.some(n=>n===`Alive-Set-Manager-${pkg.version}-${suffix}`)) throw new Error(`Missing release artifact: ${suffix}`);
  for(const platform of ['mac-arm64','mac-x64','win-x64']) for(const prefix of ['sbom','notices']) if(!names.includes(`${prefix}-${platform}.${prefix==='sbom'?'json':'txt'}`)) throw new Error(`Missing ${prefix} for ${platform}`);
  const checksums=[];
  for(const name of names.sort()) checksums.push(`${createHash('sha256').update(await fs.readFile(path.join(dir,name))).digest('hex')}  ${name}`);
  await fs.writeFile(path.join(dir,'SHA256SUMS.txt'),checksums.join('\n')+'\n');
  await fs.writeFile('release-notes.md', `# Alive Set Manager ${pkg.version}\n\nUnsigned alpha: see installation instructions and the acceptance checklist. Live 12 is the target; platform verification status is recorded in docs/RELEASE_CHECKLIST.md.\n\n${section.replace(/^.*\n/,'')}`);
} else throw new Error('Expected validate or assemble');
