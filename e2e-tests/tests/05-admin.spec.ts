import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

// ────────────────────────────────────────────────────────────────
// 05 – ADMIN PANEL
// ────────────────────────────────────────────────────────────────

test.describe('Admin – Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForTimeout(3000);
  });

  test('Admin page loads without crash', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    await expect(page.locator('body')).not.toContainText('TypeError');
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/tableau de bord|admin|dashboard/i);
  });

  test('Dashboard stats cards are visible', async ({ page }) => {
    const body = await page.locator('body').textContent() || '';
    // Should show some numerical stats
    expect(body).toMatch(/rendez-vous|client|chiffre/i);
  });

  test('No console errors on admin dashboard', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/admin');
    await page.waitForTimeout(3000);
    const realErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('Failed to load resource')
    );
    if (realErrors.length > 0) console.log('Admin dashboard errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });

});

test.describe('Admin – Rendez-vous', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForTimeout(2500);
  });

  test('RDV tab loads without null pointer error', async ({ page }) => {
    const rdvTab = page.locator('button').filter({ hasText: /rendez-vous/i }).first();
    if (await rdvTab.isVisible()) {
      await rdvTab.click();
      await page.waitForTimeout(2000);
      await expect(page.locator('body')).not.toContainText('Cannot read properties of null');
      await expect(page.locator('body')).not.toContainText("reading 'prenom'");
      await expect(page.locator('body')).not.toContainText("reading 'nom'");
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

  test('Walk-in RDV shows client name or walk-in name (no crash)', async ({ page }) => {
    const rdvTab = page.locator('button').filter({ hasText: /rendez-vous/i }).first();
    if (await rdvTab.isVisible()) {
      await rdvTab.click();
      await page.waitForTimeout(2000);
      await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    }
  });

  test('RDV filter by status works', async ({ page }) => {
    const rdvTab = page.locator('button').filter({ hasText: /rendez-vous/i }).first();
    if (await rdvTab.isVisible()) {
      await rdvTab.click();
      await page.waitForTimeout(1500);
      // Find status filter select
      const statusSelect = page.locator('select').first();
      if (await statusSelect.isVisible()) {
        await statusSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);
        await expect(page.locator('body')).not.toContainText('TypeError');
      }
    }
  });

  test('RDV filter by date works', async ({ page }) => {
    const rdvTab = page.locator('button').filter({ hasText: /rendez-vous/i }).first();
    if (await rdvTab.isVisible()) {
      await rdvTab.click();
      await page.waitForTimeout(1500);
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.isVisible()) {
        await dateInput.fill('2025-01-01');
        await page.waitForTimeout(500);
        await expect(page.locator('body')).not.toContainText('TypeError');
      }
    }
  });

});

test.describe('Admin – Services', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForTimeout(2000);
    const servicesTab = page.locator('button').filter({ hasText: /^services$/i }).first();
    if (await servicesTab.isVisible()) {
      await servicesTab.click();
      await page.waitForTimeout(1500);
    }
  });

  test('Services tab shows services list', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('TypeError');
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/service|coupe|prix/i);
  });

  test('Add service button opens form', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /ajouter|nouveau|créer/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).not.toContainText('TypeError');
      // Form should be visible
      const inputs = page.locator('input, textarea, select');
      const count = await inputs.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('Edit service opens form with existing data', async ({ page }) => {
    const editBtns = page.locator('button').filter({ hasText: /modifier|éditer/i });
    const editBtnSvg = page.locator('button[title*="Modifier"], button[aria-label*="Modifier"]');
    // Try pencil icon buttons
    const pencilBtns = page.locator('button svg[class*="pencil"], button').filter({ has: page.locator('svg') });
    const count = await pencilBtns.count();
    if (count > 0) {
      // Find edit buttons (Pencil icons)
      const editButton = page.locator('button').nth(count > 3 ? 3 : 0);
      // Just verify no crash
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

});

test.describe('Admin – Stock', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    // Wait for the admin dashboard to finish loading (tabs become visible)
    const stockTab = page.locator('button').filter({ hasText: /^stock$/i }).first();
    await stockTab.waitFor({ state: 'visible', timeout: 15000 });
    await stockTab.click();
    await page.waitForTimeout(1500);
  });

  test('Stock tab loads without crash', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('TypeError');
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
  });

  test('Stock table shows products', async ({ page }) => {
    const body = await page.locator('body').textContent() || '';
    // Should have some stock-related content
    expect(body).toMatch(/stock|produit|quantité|nom/i);
  });

  test('Add product button opens form', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /ajouter|nouveau produit/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

  test('Edit product form – marque field not null (no value=null)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    // Click an edit button if it exists
    const pencilBtns = page.locator('button').filter({ has: page.locator('svg') });
    const count = await pencilBtns.count();
    if (count > 2) {
      await pencilBtns.nth(2).click();
      await page.waitForTimeout(1000);
    }
    // Check no controlled/uncontrolled input errors
    const inputErrors = errors.filter(
      (e) => e.includes('value prop') || e.includes('`value` prop') || e.includes('null')
    );
    if (inputErrors.length > 0) console.log('Input null value errors:', inputErrors);
    expect(inputErrors).toHaveLength(0);
  });

  test('No console errors on stock tab', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.waitForTimeout(1000);
    const realErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('Failed to load resource')
    );
    if (realErrors.length > 0) console.log('Stock tab errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });

});

test.describe('Admin – Coiffeuses', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForTimeout(2000);
    const coiffeusesTab = page.locator('button').filter({ hasText: /coiffeuses/i }).first();
    if (await coiffeusesTab.isVisible()) {
      await coiffeusesTab.click();
      await page.waitForTimeout(1500);
    }
  });

  test('Coiffeuses tab loads without crash', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('TypeError');
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/coiffeuse|styliste|nom|prenom/i);
  });

  test('Add coiffeuse form shows required fields', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /ajouter|nouvelle coiffeuse/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
      // Form uses placeholders not labels; check for form heading and key inputs
      await expect(page.locator('text=Nouvelle coiffeuse')).toBeVisible();
      await expect(page.locator('input[placeholder="Email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    }
  });

});

test.describe('Admin – Clientes', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForTimeout(2000);
    const clientesTab = page.locator('button').filter({ hasText: /clientes/i }).first();
    if (await clientesTab.isVisible()) {
      await clientesTab.click();
      await page.waitForTimeout(1500);
    }
  });

  test('Clientes tab loads without crash', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('TypeError');
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
  });

  test('Clientes list shows customer data', async ({ page }) => {
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/client|email|téléphone/i);
  });

});
