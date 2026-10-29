import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', testMatch: '**/electron.spec.ts', workers: 1, timeout: 60000, use: { trace: 'retain-on-failure' }, reporter: [['list']] });
