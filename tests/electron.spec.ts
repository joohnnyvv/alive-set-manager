import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
test('packaged desktop boots, exposes safe setup, reloads and preserves preferences', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'alive-electron-'));
  const executablePath = process.env.ASM_EXECUTABLE;
  const launch = () => electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: {...process.env, ASM_DATA_DIR:directory, ASM_DEMO:'1'} });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await expect(page.getByRole('heading',{name:'Ready for your next set.'})).toBeVisible();
    await expect(page.getByText('Bundled version:',{exact:false})).toContainText('4.1.0');
    await page.getByRole('button',{name:'Done / skip setup'}).click();
    expect(await page.evaluate(()=>typeof (window as any).require)).toBe('undefined');
    // Load the native addon in Electron, without accessing physical MIDI ports.
    expect(await app.evaluate(async ({app}) => { const {createRequire} = process.getBuiltinModule('module')!; const req=createRequire(app.getAppPath()+'/package.json'); return typeof req('easymidi').getInputs; })).toBe('function');
    await page.reload();
    await expect(page.getByRole('heading',{name:'Setlist',exact:true})).toBeVisible();
    await app.close(); app = await launch(); page = await app.firstWindow();
    await expect(page.getByRole('heading',{name:'Setlist',exact:true})).toBeVisible();
    await expect(page.locator('.live-status-bar')).toHaveText('Live connected');
  } finally { await app.close(); await fs.rm(directory,{recursive:true,force:true}); }
});
