import { config as loadEnv } from 'dotenv';
import { defineConfig } from '@playwright/test';

loadEnv({ path: '.env.test', quiet: true });

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    // Uses the locally installed Google Chrome instead of downloading a browser.
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // A direct `node next` invocation (rather than pnpm -> dotenv -> next)
    // gives Playwright a single process it can stop cleanly after the run.
    command: `node node_modules/next/dist/bin/next dev -p ${PORT}`,
    url: `${baseURL}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'ignore',
    env: {
      ...(process.env as Record<string, string>),
      DATABASE_URL: process.env.DATABASE_URL ?? '',
    },
  },
});
