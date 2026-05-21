import { defineConfig } from '@playwright/test';

const baseUrl = process.env.BT_E2E_BASE_URL || 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: baseUrl,
    trace: 'retain-on-failure',
  },
});
