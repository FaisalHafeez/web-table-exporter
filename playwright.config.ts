import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  use: { headless: true },
  webServer: {
    command: 'node tests/server.mjs',
    url: 'http://127.0.0.1:4173/tests/fixture.html',
    reuseExistingServer: !process.env.CI,
  },
});
