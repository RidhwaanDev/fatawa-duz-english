/* Runs the same E2E suite against the deployed production site.
   Usage: npx playwright test --config=playwright.prod.config.js */
const { defineConfig, devices } = require('@playwright/test');

const BASE = process.env.PROD_URL || 'https://fatawa-english.netlify.app';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 25000 },
  fullyParallel: true,
  workers: 3,
  reporter: [['list']],
  use: { baseURL: BASE, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile',  use: { ...devices['iPhone 13'] } },
  ],
});
