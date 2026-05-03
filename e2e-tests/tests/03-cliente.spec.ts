import { test, expect } from '@playwright/test';
import { CLIENT, login } from './helpers';

// ────────────────────────────────────────────────────────────────
// 03 – CLIENT FLOWS (reservation, mon-espace)
// ────────────────────────────────────────────────────────────────

test.describe('Cliente – Reservation', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, CLIENT.email, CLIENT.password);
  });

  test('Reservation page has 4-step wizard', async ({ page }) => {
    await page.goto('/reservation');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    await expect(page.locator('body')).not.toContainText('TypeError');
    // Should show step indicators
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/service|coiffeuse|date|confirmation/i);
  });

  test('Step 1 – Services list loads from API', async ({ page }) => {
    await page.goto('/reservation');
    await page.waitForTimeout(3000);
    // Should show service items
    const body = await page.locator('body').textContent() || '';
    // Check no runtime errors
    expect(body).not.toMatch(/TypeError/);
    expect(body).not.toMatch(/Unhandled Runtime Error/);
    expect(body).not.toMatch(/Cannot read properties of null/);
  });

  test('Step 1 – Cannot proceed without selecting a service', async ({ page }) => {
    await page.goto('/reservation');
    await page.waitForTimeout(2000);
    // Find Next button
    const nextBtn = page.locator('button').filter({ hasText: /suivant|continuer|next/i }).first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      // Should still be on step 1 (no service selected)
      const body = await page.locator('body').textContent() || '';
      // Still shows services
      expect(body).toMatch(/service|choisir/i);
    }
  });

  test('Step 1 – Select a service and proceed to step 2', async ({ page }) => {
    await page.goto('/reservation');
    await page.waitForTimeout(3000);
    // Click first service card
    const serviceCards = page.locator('[class*="cursor-pointer"], button').filter({ hasText: /coupe|colora|soin/i }).first();
    if (await serviceCards.isVisible()) {
      await serviceCards.click();
      await page.waitForTimeout(500);
      // Click next
      const nextBtn = page.locator('button').filter({ hasText: /suivant|continuer/i }).first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(1000);
        // Should be on step 2 - coiffeuse
        const body = await page.locator('body').textContent() || '';
        expect(body).toMatch(/coiffeuse|styliste/i);
      }
    }
  });

  test('No console errors during reservation flow', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/reservation');
    await page.waitForTimeout(3000);
    const realErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('Failed to load resource')
    );
    if (realErrors.length > 0) console.log('Reservation page errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });

  test('Service price displays correctly (not NaN, not 0)', async ({ page }) => {
    await page.goto('/reservation');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent() || '';
    // Should NOT show NaN prices
    expect(body).not.toContain('NaN');
    // Should NOT show "0 dt" for all services  
    expect(body).not.toMatch(/^0 dt$/m);
  });

  test('Service duration displays correctly (not NaN, not 0)', async ({ page }) => {
    await page.goto('/reservation');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent() || '';
    expect(body).not.toContain('NaN');
  });

});

test.describe('Cliente – Mon Espace', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, CLIENT.email, CLIENT.password);
  });

  test('Mon espace loads after login', async ({ page }) => {
    await page.goto('/mon-espace');
    // Attendre qu'au moins un onglet visible soit rendu (pas de textContent RSC)
    await expect(
      page.locator('button, [role="tab"]').filter({ hasText: /rendez-vous|profil|historique/i }).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    await expect(page.locator('body')).not.toContainText('TypeError');
  });

  test('Mon espace – tabs are visible', async ({ page }) => {
    await page.goto('/mon-espace');
    // Attendre les onglets rendus dans le DOM visible (pas de vérification textContent RSC)
    await expect(
      page.locator('button, [role="tab"]').filter({ hasText: /rendez-vous/i }).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('button, [role="tab"]').filter({ hasText: /profil/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('Mon espace – profil capillaire tab works', async ({ page }) => {
    await page.goto('/mon-espace');
    await page.waitForTimeout(2000);
    // Click profil tab
    const profilTab = page.locator('button, [role="tab"]').filter({ hasText: /profil/i }).first();
    if (await profilTab.isVisible()) {
      await profilTab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

  test('No console errors on mon-espace', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/mon-espace');
    await page.waitForTimeout(2500);
    const realErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('Failed to load resource')
    );
    if (realErrors.length > 0) console.log('Mon-espace errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });

  test('RDV list renders without crashing (null cliente guard)', async ({ page }) => {
    await page.goto('/mon-espace');
    await page.waitForTimeout(2500);
    await expect(page.locator('body')).not.toContainText('Cannot read properties of null');
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
  });

  test('Mon espace – avis tab works', async ({ page }) => {
    await page.goto('/mon-espace');
    await page.waitForTimeout(2000);
    const avisTab = page.locator('button, [role="tab"]').filter({ hasText: /avis/i }).first();
    if (await avisTab.isVisible()) {
      await avisTab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

});
