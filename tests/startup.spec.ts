import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Keep the desktop setup lifecycle available while using the real demo backend.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'desktop', { value: {
      info: async () => {
        const info = { version: 'test', platform: 'test', arch: 'test', setupComplete: sessionStorage.getItem('setup-complete') === 'true' };
        if (new URLSearchParams(location.search).has('delaySetup')) {
          return new Promise(resolve => { (window as any).resolveStartupInfo = () => resolve(info); });
        }
        return info;
      },
      scriptStatus: async () => ({ bundledVersion: 'test', destination: 'test', state: 'missing' }),
      finishSetup: async () => { sessionStorage.setItem('setup-complete', 'true'); },
      onHelp: () => () => {},
    } });
  });
});

test('choosing any startup view dismisses setup and survives reload', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ready for your next set.' })).toBeVisible();
  try {
    for (const view of ['performance', 'sections', 'setlist']) {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await expect(page.locator('.live-status-bar')).toHaveText('Live connected');
      await page.getByLabel('Default View on App Start').selectOption(view);
      await expect.poll(async () => (await (await request.get('/api/state')).json()).settings.defaultView).toBe(view);
      // Changing the startup preference should leave the current page in place.
      await expect(page.locator('.nav-btn.is-active')).toHaveAttribute('data-view', 'settings');
      await page.reload();
      await expect(page.locator('.nav-btn.is-active')).toHaveAttribute('data-view', view);
      await expect(page.locator('.live-status-bar')).toHaveText('Live connected');
      await expect(page.locator('.nav-btn.is-active')).toHaveAttribute('data-view', view);
    }
  } finally {
    await request.post('/api/settings', { data: { defaultView: 'setlist' } });
  }
});

test('a delayed first-run check does not override user navigation', async ({ page }) => {
  await page.goto('/?delaySetup=1');
  await expect(page.locator('.live-status-bar')).toHaveText('Live connected');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.evaluate(() => (window as any).resolveStartupInfo());
  await expect(page.locator('.nav-btn.is-active')).toHaveAttribute('data-view', 'settings');
});
