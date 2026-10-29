import semver from 'semver';
import type { UpdateResult } from './contracts.js';
export const repository = 'https://github.com/joohnnyvv/alive-set-manager';
interface Release { draft?: boolean; tag_name: string; body?: string; assets?: { name: string; browser_download_url: string }[]; }

export function selectUpdate(releases: Release[], current: string, platform: string, arch: string): UpdateResult {
  const candidates = releases.filter(r => !r.draft && semver.valid(r.tag_name) && semver.gt(r.tag_name, current)
    && (semver.prerelease(current) || !semver.prerelease(r.tag_name)))
    .sort((a, b) => semver.rcompare(a.tag_name, b.tag_name));
  if (!candidates.length) return { status: 'current' };
  const latest = candidates[0];
  const suffix = platform === 'darwin' ? `mac-${arch}.dmg` : platform === 'win32' ? `win-${arch}.exe` : '';
  const asset = latest.assets?.find(a => suffix && a.name.endsWith(suffix)
    && a.browser_download_url.startsWith(`${repository}/releases/download/`));
  if (!asset) return { status: 'unavailable', version: latest.tag_name, message: 'The latest release has no download for this computer. Check the release notes.' };
  return { status: 'available', version: latest.tag_name, notes: latest.body || '', url: asset.browser_download_url };
}

export async function checkUpdates(current: string, platform: string, arch: string): Promise<UpdateResult> {
  try {
    const response = await fetch('https://api.github.com/repos/joohnnyvv/alive-set-manager/releases?per_page=100', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Alive-Set-Manager' }, signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? 'GitHub rate limit reached. Try again later.' : 'Release information is temporarily unavailable.');
    const releases = await response.json();
    if (!Array.isArray(releases)) throw new Error('Invalid release information.');
    return selectUpdate(releases, current, platform, arch);
  } catch (error) { return { status: 'unavailable', message: error instanceof Error ? error.message : 'Unable to check updates. Check your connection.' }; }
}
