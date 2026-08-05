import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Phase 6 — Final System Polish & Verification', () => {

  test('1. Verify build output artifacts exist and are non-empty', async () => {
    const distBackend = path.join(process.cwd(), 'dist', 'src', 'index.js');
    const distFrontendHtml = path.join(process.cwd(), 'frontend', 'dist', 'index.html');

    const backendStat = await fs.stat(distBackend);
    const frontendStat = await fs.stat(distFrontendHtml);

    assert.ok(backendStat.size > 0, 'Backend build index.js should exist and be non-empty');
    assert.ok(frontendStat.size > 0, 'Frontend build index.html should exist and be non-empty');
  });

  test('2. Verify mobile viewport & touch optimization settings in HTML & CSS', async () => {
    const htmlPath = path.join(process.cwd(), 'frontend', 'index.html');
    const cssPath = path.join(process.cwd(), 'frontend', 'style.css');

    const htmlContent = await fs.readFile(htmlPath, 'utf-8');
    const cssContent = await fs.readFile(cssPath, 'utf-8');

    assert.ok(htmlContent.includes('user-scalable=no'), 'Viewport meta should disable zoom');
    assert.ok(htmlContent.includes('viewport-fit=cover'), 'Viewport meta should use cover fit');
    assert.ok(cssContent.includes('touch-action: manipulation'), 'CSS should include touch-action manipulation');
  });

});
