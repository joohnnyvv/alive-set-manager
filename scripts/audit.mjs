import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const advisory = 'https://github.com/advisories/GHSA-g3hv-75wg-m249';
const expires = Date.parse('2026-12-03T00:00:00Z');
const legacyPaths = new Map([
  ['node_modules/@electron/asar/node_modules/minimatch', '3.1.5'],
  ['node_modules/dir-compare/node_modules/minimatch', '3.1.5'],
  ['node_modules/glob/node_modules/minimatch', '3.1.5'],
  ['node_modules/filelist/node_modules/minimatch', '5.1.9'],
]);
const levels = new Map(['info', 'low', 'moderate', 'high', 'critical'].map((s, i) => [s, i]));

// Evaluate direct advisories; npm's string "via" entries propagate the same findings
// through their dependants. Unknown/malformed reports fail closed.
export function evaluateAudit(report, lock, now = Date.now()) {
  if (report.error || report.auditReportVersion !== 2 || !report.vulnerabilities) {
    throw new Error('Missing or unsupported npm audit report');
  }
  const blocked = new Set();
  const excepted = new Set();
  let directFindings = 0;
  for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
    if (!Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
      throw new Error(`Missing advisory details for ${name}`);
    }
    for (const via of vulnerability.via) {
      if (typeof via === 'string') {
        if (!report.vulnerabilities[via]) throw new Error(`Unresolved advisory: ${via}`);
        continue;
      }
      directFindings++;
      if (!levels.has(via.severity)) throw new Error('Unknown advisory severity');
      if (levels.get(via.severity) < levels.get('moderate')) continue;
      const legacyOnly =
        name === 'minimatch' &&
        via.name === 'minimatch' &&
        via.url === advisory &&
        via.severity === 'moderate' &&
        now < expires &&
        Array.isArray(vulnerability.nodes) &&
        vulnerability.nodes.length > 0 &&
        vulnerability.nodes.every((node) => {
          const entry = lock.packages?.[node];
          return (
            legacyPaths.has(node) && entry?.version === legacyPaths.get(node) && entry.dev === true
          );
        });
      if (legacyOnly) excepted.add(via.url);
      else blocked.add(`${name}: ${via.url ?? via.title ?? 'unknown advisory'}`);
    }
  }
  if (Object.keys(report.vulnerabilities).length && !directFindings) {
    throw new Error('Audit report has no direct advisory details');
  }
  return { blocked: [...blocked], excepted: [...excepted] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['audit', '--json'],
      {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    if (result.error || ![0, 1].includes(result.status)) {
      throw result.error ?? new Error(result.stderr || 'npm audit failed');
    }
    const outcome = evaluateAudit(
      JSON.parse(result.stdout),
      JSON.parse(readFileSync('package-lock.json', 'utf8')),
    );
    for (const url of outcome.excepted)
      console.warn(`Temporary legacy-only exception (expires 2026-12-03): ${url}`);
    for (const finding of outcome.blocked) console.error(finding);
    process.exitCode = outcome.blocked.length ? 1 : 0;
    if (!outcome.blocked.length)
      console.log('Dependency audit passed under the documented policy (see SECURITY.md).');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
