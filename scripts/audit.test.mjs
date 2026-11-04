import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAudit } from './audit.mjs';

const url = 'https://github.com/advisories/GHSA-g3hv-75wg-m249';
const path = 'node_modules/glob/node_modules/minimatch';
const now = Date.parse('2026-11-03');
function fixture() {
  return {
    report: {
      auditReportVersion: 2,
      vulnerabilities: {
        minimatch: { nodes: [path], via: [{ name: 'minimatch', url, severity: 'moderate' }] },
        glob: { via: ['minimatch'] },
      },
    },
    lock: { packages: { [path]: { version: '3.1.5', dev: true } } },
  };
}

test('allows the reviewed legacy advisory and its propagated dependants', () => {
  const { report, lock } = fixture();
  assert.deepEqual(evaluateAudit(report, lock, now), { blocked: [], excepted: [url] });
});
for (const scenario of [
  'new advisory',
  'higher severity',
  'modern version',
  'production',
  'unknown path',
  'expired',
]) {
  test(`blocks ${scenario}`, () => {
    const { report, lock } = fixture();
    let date = now;
    if (scenario === 'new advisory')
      report.vulnerabilities.minimatch.via.push({
        name: 'minimatch',
        url: 'https://example.com/new',
        severity: 'moderate',
      });
    if (scenario === 'higher severity') report.vulnerabilities.minimatch.via[0].severity = 'high';
    if (scenario === 'modern version') lock.packages[path].version = '10.2.6';
    if (scenario === 'production') lock.packages[path].dev = false;
    if (scenario === 'unknown path')
      report.vulnerabilities.minimatch.nodes.push('node_modules/minimatch');
    if (scenario === 'expired') date = Date.parse('2026-12-03');
    assert.equal(evaluateAudit(report, lock, date).blocked.length, 1);
  });
}
test('fails closed on audit service errors and incomplete reports', () => {
  for (const report of [
    { error: { code: 'ENOAUDIT' } },
    {},
    { auditReportVersion: 2, vulnerabilities: { glob: { via: ['missing'] } } },
  ]) {
    assert.throws(() => evaluateAudit(report, {}, now));
  }
});
test('accepts a clean audit', () => {
  assert.deepEqual(evaluateAudit({ auditReportVersion: 2, vulnerabilities: {} }, {}, now), {
    blocked: [],
    excepted: [],
  });
});
