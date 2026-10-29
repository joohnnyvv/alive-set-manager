import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
test('capture the theme gallery and populated views', async ({page,request}) => {
  await fs.mkdir('docs/images',{recursive:true});
  await request.post('http://127.0.0.1:4174',{data:{type:'empty',value:false}});
  await page.clock.setFixedTime(new Date('2026-10-29T19:30:00Z'));
  await page.goto('/');
  await expect(page.locator('.live-status-bar')).toHaveText('Live connected');
  for (const theme of ['midnight','live-dark','live-light','high-contrast','soft-dark']) {
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    await page.locator(`[data-theme-val="${theme}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await page.getByRole('button',{name:'Stage View',exact:true}).click();
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('.toast')).toHaveCount(0);
    await page.screenshot({path:`docs/images/theme-${theme}.png`,fullPage:true});
  }
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.locator('[data-theme-val="live-dark"]').click();
  for (const [label,file] of [['Setlist','setlist'],['Sections','sections'],['Help','help']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await expect(page.locator('.toast')).toHaveCount(0);
    await page.screenshot({path:`docs/images/${file}.png`,fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Stage View',exact:true}).click();
  await page.screenshot({path:'docs/images/mobile.png',fullPage:true});
});
