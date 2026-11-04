import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1050 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--no-sandbox'],
    },
    screenshot: 'only-on-failure',
    // The Premium pop-up would cover pages in tests that are not about it; its own tests turn it on.
    storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:5173', localStorage: [{ name: 'studymode.nudge.off', value: '1' }] }] },
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
