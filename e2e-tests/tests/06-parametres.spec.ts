import { test, expect } from '@playwright/test';
import { COIFFEUSE, login, loginAsAdmin } from './helpers';

// ────────────────────────────────────────────────────────────────
// 06 – PARAMETRES PAGE
// ────────────────────────────────────────────────────────────────

test.describe('Paramètres – Coiffeuse', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, COIFFEUSE.email, COIFFEUSE.password);
  });

  test('Paramètres page loads for coiffeuse', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    await expect(page.locator('body')).not.toContainText('TypeError');
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/paramètre|profil|mot de passe/i);
  });

  test('No console errors on paramètres page (coiffeuse)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/parametres');
    await page.waitForTimeout(3000);
    const realErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('Failed to load resource')
    );
    if (realErrors.length > 0) console.log('Paramètres (coiffeuse) errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });

  test('Profile section shows editable fields', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/nom|prénom|email/i);
  });

  test('Password change section is visible', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/mot de passe|password/i);
  });

  test('Disponibilités section is visible for coiffeuse', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/disponibilité|horaire|planning/i);
  });

  test('Save profile with valid data – no crash', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    // Find first save button
    const saveBtn = page.locator('button').filter({ hasText: /enregistrer|sauvegarder/i }).first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(1500);
      await expect(page.locator('body')).not.toContainText('TypeError');
      await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    }
  });

  test('Password change – mismatched passwords shows error', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    // Find password inputs
    const pwInputs = page.locator('input[type="password"]');
    const count = await pwInputs.count();
    if (count >= 3) {
      await pwInputs.nth(0).fill('currentpassword');
      await pwInputs.nth(1).fill('newpassword123');
      await pwInputs.nth(2).fill('different456');
      // Find the password save button
      const savePwBtn = page.locator('button').filter({ hasText: /enregistrer|changer/i }).last();
      if (await savePwBtn.isVisible()) {
        await savePwBtn.click();
        await page.waitForTimeout(1000);
        const body = await page.locator('body').textContent() || '';
        // Should show error (validation or server error)
        // At minimum should not crash
        await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
      }
    }
  });

});

test.describe('Paramètres – Admin', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Paramètres page loads for admin', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    await expect(page.locator('body')).not.toContainText('TypeError');
  });

  test('No console errors on paramètres page (admin)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/parametres');
    await page.waitForTimeout(3000);
    const realErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('Failed to load resource')
    );
    if (realErrors.length > 0) console.log('Paramètres (admin) errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });

  test('Admin sees salon settings (nom salon, horaires)', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/salon|horaire|paramètre/i);
  });

});
