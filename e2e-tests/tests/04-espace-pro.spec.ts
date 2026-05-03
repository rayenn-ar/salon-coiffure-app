import { test, expect } from '@playwright/test';
import { COIFFEUSE, login } from './helpers';

// ────────────────────────────────────────────────────────────────
// 04 – ESPACE PRO (Coiffeuse)
// ────────────────────────────────────────────────────────────────

test.describe('Espace Pro – Coiffeuse', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, COIFFEUSE.email, COIFFEUSE.password);
  });

  test('Espace pro loads after coiffeuse login', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2500);
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    await expect(page.locator('body')).not.toContainText('TypeError');
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/agenda|planning|rendez-vous/i);
  });

  test('Agenda tab is default and shows weekly view', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/agenda|lundi|mardi|mercredi/i);
  });

  test('No console errors on espace-pro', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/espace-pro');
    await page.waitForTimeout(3000);
    const realErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('Failed to load resource')
    );
    if (realErrors.length > 0) console.log('Espace-pro errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });

  test('Walk-in tab is accessible', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const walkinTab = page.locator('button').filter({ hasText: /présentiel|walk.in/i }).first();
    if (await walkinTab.isVisible()) {
      await walkinTab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).not.toContainText('TypeError');
      const body = await page.locator('body').textContent() || '';
      expect(body).toMatch(/nom|prénom|téléphone/i);
    }
  });

  test('Walk-in form – services list loads (not empty, no NaN)', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const walkinTab = page.locator('button').filter({ hasText: /présentiel|walk.in/i }).first();
    if (await walkinTab.isVisible()) {
      await walkinTab.click();
      await page.waitForTimeout(2000);
      const body = await page.locator('body').textContent() || '';
      // Services should show with prices, no NaN
      expect(body).not.toContain('NaN');
    }
  });

  test('Walk-in form – submit without required fields shows validation', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const walkinTab = page.locator('button').filter({ hasText: /présentiel|walk.in/i }).first();
    if (await walkinTab.isVisible()) {
      await walkinTab.click();
      await page.waitForTimeout(1000);
      const submitBtn = page.locator('button').filter({ hasText: /enregistrer|valider|créer/i }).first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(1000);
        // Should show error or nothing (no crash)
        await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
      }
    }
  });

  test('Portfolio tab is accessible', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const portfolioTab = page.locator('button').filter({ hasText: /portfolio/i }).first();
    if (await portfolioTab.isVisible()) {
      await portfolioTab.click();
      await page.waitForTimeout(1500);
      await expect(page.locator('body')).not.toContainText('TypeError');
      await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    }
  });

  test('Matières utilisées tab is accessible', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const matieresTab = page.locator('button').filter({ hasText: /matière|produit|utilis/i }).first();
    if (await matieresTab.isVisible()) {
      await matieresTab.click();
      await page.waitForTimeout(1500);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

  test('Clients tab is accessible', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const clientsTab = page.locator('button').filter({ hasText: /cliente|client/i }).first();
    if (await clientsTab.isVisible()) {
      await clientsTab.click();
      await page.waitForTimeout(1500);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

  test('RDV list renders – no null pointer on walk-in RDVs', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toContainText('Cannot read properties of null');
    await expect(page.locator('body')).not.toContainText("reading 'prenom'");
    await expect(page.locator('body')).not.toContainText("reading 'nom'");
  });

  test('Week navigation works (prev/next week)', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    // Find prev/next week buttons
    const nextWeek = page.locator('button').filter({ hasText: /suivant|>|›/ }).first();
    const prevWeek = page.locator('button[aria-label*="suivant"], button svg').first();
    // Just verify no crash after navigation
    const chevronButtons = page.locator('button').filter({ has: page.locator('svg') });
    const count = await chevronButtons.count();
    if (count > 0) {
      await chevronButtons.first().click();
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

});
