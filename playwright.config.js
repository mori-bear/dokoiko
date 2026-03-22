import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
  },

  webServer: {
    command: 'npx serve . -l 4173 --no-clipboard',
    port: 4173,
    reuseExistingServer: true,
  },
});
