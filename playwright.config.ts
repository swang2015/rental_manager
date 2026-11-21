import { defineConfig } from '@playwright/test';

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
    command: `pnpm exec dotenv run -q -f .env.test -- next dev -p ${PORT}`,
    url: `${baseURL}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
