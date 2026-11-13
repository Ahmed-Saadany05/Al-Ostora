import { defineConfig } from '@playwright/test';

/** Browser checks (Chrome only). Reuses a dev server on :5180 if one is running, otherwise starts one. */
export default defineConfig({
  testDir: 'src',
  testMatch: '**/*.e2e.ts',
  timeout: 180_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5180',
    channel: 'chrome',
    headless: true,
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run dev -- --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: true,
  },
});
