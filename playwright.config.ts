import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e/playwright',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Pixel 7'],
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: '/opt/google/chrome/chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  },
  outputDir: '/tmp/pw-results/',
});
