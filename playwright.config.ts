import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testIgnore: '**/electron.spec.ts', workers: 1, fullyParallel: false,
  timeout: 30000, retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run demo', url: 'http://127.0.0.1:4173/api/state', reuseExistingServer: false, timeout: 30000 },
});
