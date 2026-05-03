import { chromium } from '@playwright/test';

/**
 * Global setup: pre-warms all Next.js pages to trigger compilation before tests run.
 * Without this, the first test to visit a page can get ERR_ABORTED while Next.js compiles.
 */
export default async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const BASE_URL = 'http://localhost:3000';
  const pagesToWarm = [
    '/',
    '/connexion',
    '/inscription',
    '/services',
    '/coiffeuses',
    '/reservation',
    '/mon-espace',
    '/espace-pro',
    '/admin',
    '/parametres',
  ];

  for (const path of pagesToWarm) {
    try {
      await page.goto(`${BASE_URL}${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
    } catch {
      // Ignore errors (auth redirects, etc.) — we just need compilation to run
    }
  }

  await browser.close();
}
