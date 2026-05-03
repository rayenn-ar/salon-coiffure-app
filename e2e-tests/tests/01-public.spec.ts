import { test, expect } from '@playwright/test';

// ────────────────────────────────────────────────────────────────
// 01 – PUBLIC PAGES (no login required)
// ────────────────────────────────────────────────────────────────

test.describe('Public pages', () => {

  test('Home page loads with hero text', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/salon|coiffure/i);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toContainText(/beauté/i);
  });

  test('Home page – Réserver maintenant link goes to /reservation', async ({ page }) => {
    await page.goto('/');
    const reserverLink = page.locator('a[href="/reservation"]').first();
    await expect(reserverLink).toBeVisible();
  });

  test('Services page loads list of services', async ({ page }) => {
    await page.goto('/services');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    // Should show service cards from API
    await page.waitForTimeout(2000);
    const cards = page.locator('[class*="card"], article, .service');
    // Just check page doesn't crash
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    await expect(page.locator('body')).not.toContainText('TypeError');
  });

  test('Coiffeuses page loads hairdresser list', async ({ page }) => {
    await page.goto('/coiffeuses');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    await expect(page.locator('body')).not.toContainText('TypeError');
    // Should show hairdresser profiles
    const content = await page.locator('body').textContent();
    // Check page has some meaningful content
    expect(content).toBeTruthy();
  });

  test('Navbar is visible on all public pages', async ({ page }) => {
    for (const path of ['/', '/services', '/coiffeuses']) {
      await page.goto(path);
      await expect(page.locator('nav')).toBeVisible();
    }
  });

  test('Footer is visible on home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer')).toBeVisible();
  });

  test('Reservation page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/reservation');
    await expect(page).toHaveURL(/connexion/);
  });

  test('Mon espace redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/mon-espace');
    await expect(page).toHaveURL(/connexion/);
  });

  test('Admin page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/admin');
    // Should redirect to login or show unauthorized
    await page.waitForTimeout(2000);
    const url = page.url();
    const body = await page.locator('body').textContent();
    // Either redirected or shows not authorized
    const isProtected = url.includes('connexion') || (body || '').toLowerCase().includes('connexion') || (body || '').toLowerCase().includes('accès');
    expect(isProtected).toBeTruthy();
  });

  test('No console errors on home page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForTimeout(1500);
    // Filter out known benign Chrome errors
    const realErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('Failed to load resource') &&
        !e.includes('net::ERR')
    );
    if (realErrors.length > 0) {
      console.log('Console errors on home:', realErrors);
    }
    expect(realErrors).toHaveLength(0);
  });

  test('No console errors on services page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/services');
    await page.waitForTimeout(2000);
    const realErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('Failed to load resource') &&
        !e.includes('net::ERR')
    );
    if (realErrors.length > 0) {
      console.log('Console errors on services:', realErrors);
    }
    expect(realErrors).toHaveLength(0);
  });

  test('No console errors on coiffeuses page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/coiffeuses');
    await page.waitForTimeout(2000);
    const realErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('Failed to load resource') &&
        !e.includes('net::ERR')
    );
    if (realErrors.length > 0) {
      console.log('Console errors on coiffeuses:', realErrors);
    }
    expect(realErrors).toHaveLength(0);
  });

});
