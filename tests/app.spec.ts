import { test, expect } from '@playwright/test';
const control = (request: any, command: object) => request.post('http://127.0.0.1:4174', { data: command });
test.beforeEach(async ({ page, request }) => {
  await control(request, { type: 'connection', value: true });
  await control(request, { type: 'empty', value: false });
  await page.goto('/');
  await expect(page.locator('.live-status-bar')).toHaveText('Live connected');
});
test('real backend renders songs, transport and queued manual jumps', async ({ page, request }) => {
  await expect(page.getByText('Northern Lights', { exact: true }).first()).toBeVisible();
  await page.getByRole('button',{name:'Stage View',exact:true}).click();
  await page.getByTitle('Play', { exact: true }).click();
  await expect(page.getByTitle('Pause', { exact: true })).toBeVisible();
  await page.getByRole('button', {name:'Settings',exact:true}).click();
  await page.locator('input[type=radio][value=manual]').check();
  await page.getByRole('button',{name:'Setlist',exact:true}).click();
  await page.getByText('Paper Satellites', {exact:true}).first().click();
  await expect.poll(async () => (await (await request.get('/api/state')).json()).setlist.queuedSongId).toBeTruthy();
  await page.getByRole('button',{name:'Stage View',exact:true}).click();
  await page.locator('.btn-go').click();
  await expect.poll(async () => (await (await request.get('/api/state')).json()).playback.currentTime).toBe(176);
  await page.getByTitle('Pause',{exact:true}).click();
});
test('all themes, save dialog keyboard focus, and setlist persistence', async ({ page }) => {
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  for (const theme of ['midnight','live-dark','live-light','high-contrast','soft-dark']) {
    await page.locator(`[data-theme-val="${theme}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  }
  await page.getByRole('button',{name:'Setlist',exact:true}).click();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  const modal=page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.locator('input')).toBeFocused();
  await modal.locator('input').fill('E2E rehearsal');
  await modal.getByRole('button',{name:'Save',exact:true}).click();
  await expect(modal).toBeHidden();
  await page.reload();
  await page.getByRole('button',{name:'Load',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Saved setlist'}).locator('option')).toContainText(['E2E_rehearsal']);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});
test('empty, lost Live connection, reconnect, mobile help', async ({ page,request }) => {
  await control(request,{type:'empty',value:true});
  await expect(page.getByText('No Songs Available')).toBeVisible();
  await control(request,{type:'connection',value:false});
  await expect(page.locator('.live-status-bar')).toContainText('not connected');
  await control(request,{type:'connection',value:true});
  await control(request,{type:'empty',value:false});
  await expect(page.getByText('Northern Lights',{exact:true}).first()).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Help',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Ready for your next set.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Install / repair script'})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
