import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Frontend Layout & Mobile Optimization', () => {

  test('verifies mobile viewport and touch optimization settings in HTML & CSS', async () => {
    const htmlPath = path.join(process.cwd(), 'frontend', 'index.html');
    const cssPath = path.join(process.cwd(), 'frontend', 'style.css');

    const htmlContent = await fs.readFile(htmlPath, 'utf-8');
    const cssContent = await fs.readFile(cssPath, 'utf-8');

    assert.ok(htmlContent.includes('user-scalable=no'), 'Viewport meta should disable zoom');
    assert.ok(htmlContent.includes('viewport-fit=cover'), 'Viewport meta should use cover fit');
    assert.ok(cssContent.includes('touch-action: manipulation'), 'CSS should include touch-action manipulation');
  });

});
