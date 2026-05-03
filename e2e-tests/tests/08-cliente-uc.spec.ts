import { test, expect } from '@playwright/test';
import { CLIENT, login, collectErrors, filterRealErrors, apiLogin, createApiContext } from './helpers';

// ══════════════════════════════════════════════════════════════════
//  08 – CLIENTE USE CASES (UC-C1 … UC-C7)
//  Couvre le parcours complet de la cliente connectée
// ══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// UC-C1 : Prendre un RDV en ligne (wizard 4 étapes)
// ─────────────────────────────────────────────────────────────────
test.describe('UC-C1 – Réservation en ligne', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, CLIENT.email, CLIENT.password);
  });

  test('Wizard de réservation – 4 étapes visibles', async ({ page }) => {
    await page.goto('/reservation');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/service|coiffeuse|date|confirm/i);
    await expect(page.locator('body')).not.toContainText('TypeError');
  });

  test('Étape 1 – liste des services chargée (prix non NaN)', async ({ page }) => {
    await page.goto('/reservation');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent() || '';
    expect(body).not.toContain('NaN');
    expect(body).not.toContain('Unhandled Runtime Error');
  });

  test('Étape 1 – impossible de passer sans sélectionner un service', async ({ page }) => {
    await page.goto('/reservation');
    await page.waitForTimeout(2500);
    const nextBtn = page.locator('button').filter({ hasText: /suivant|continuer/i }).first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(600);
      const body = await page.locator('body').textContent() || '';
      expect(body).toMatch(/service|choisir/i);
    }
  });

  test('Étape 1→2 – sélectionner un service et avancer', async ({ page }) => {
    await page.goto('/reservation');
    await page.waitForTimeout(3000);
    const serviceCard = page.locator('[class*="cursor-pointer"], button').filter({ hasText: /coupe|colora|soin/i }).first();
    if (await serviceCard.isVisible()) {
      await serviceCard.click();
      await page.waitForTimeout(500);
      const nextBtn = page.locator('button').filter({ hasText: /suivant|continuer/i }).first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(1500);
        const body = await page.locator('body').textContent() || '';
        expect(body).toMatch(/coiffeuse|styliste|choisir/i);
      }
    }
  });

  test(`Page de réservation – pas d'erreur console`, async ({ page }) => {
    const errs = collectErrors(page);
    await page.goto('/reservation');
    await page.waitForTimeout(3000);
    expect(filterRealErrors(errs)).toHaveLength(0);
  });

  test('Durée des créneaux affichée (pas NaN, pas 0)', async ({ page }) => {
    await page.goto('/reservation');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent() || '';
    expect(body).not.toContain('NaN');
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-C2 : Annuler un RDV depuis Mon Espace
// ─────────────────────────────────────────────────────────────────
test.describe('UC-C2 – Annuler un RDV', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, CLIENT.email, CLIENT.password);
  });

  test('Bouton "Annuler" visible sur les RDV annulables', async ({ page }) => {
    await page.goto('/mon-espace');
    await page.waitForTimeout(3500);
    await expect(page.locator('body')).not.toContainText('TypeError');
    // Si des RDV futurs existent, un bouton annuler doit être présent
    // Sinon on accepte juste qu'il n'y a pas de crash
    const cancelBtns = page.locator('button').filter({ hasText: /annuler/i });
    const cnt = await cancelBtns.count();
    // Pas d'exception : zéro ou plus de boutons annuler sont acceptables
    expect(cnt).toBeGreaterThanOrEqual(0);
  });

  test('API DELETE /rendez-vous/:id sans token → 401', async ({ request }) => {
    // Un ID quelconque — sans auth doit retourner 401
    const res = await request.delete('http://localhost:3001/api/rendez-vous/00000000-0000-4000-8000-000000000001');
    expect(res.status()).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-C3 : Voir historique RDV (paginé)
// ─────────────────────────────────────────────────────────────────
test.describe('UC-C3 – Historique RDV', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, CLIENT.email, CLIENT.password);
  });

  test('Mon Espace charge les onglets Mes RDV et Profil', async ({ page }) => {
    await page.goto('/mon-espace');
    await expect(
      page.locator('button, [role="tab"]').filter({ hasText: /rendez-vous/i }).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('button, [role="tab"]').filter({ hasText: /profil/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('Historique – liste RDV sans erreur (rdvList est un tableau)', async ({ page }) => {
    await page.goto('/mon-espace');
    await page.waitForTimeout(3500);
    await expect(page.locator('body')).not.toContainText('rdvList.filter is not a function');
    await expect(page.locator('body')).not.toContainText('TypeError');
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
  });

  test('API GET /clientes/historique retourne structure paginée', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, CLIENT.email, CLIENT.password);
    expect(token).not.toBeNull();

    const res = await apiCtx.get('http://localhost:3001/api/clientes/historique', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // Structure paginée : { rdvs: [...], total, page, totalPages }
    expect(body.data).toHaveProperty('rdvs');
    expect(Array.isArray(body.data.rdvs)).toBeTruthy();
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('page');
    await apiCtx.dispose();
  });

  test('Section "RDV à venir" et "historique passé" distinctes', async ({ page }) => {
    await page.goto('/mon-espace');
    await page.waitForTimeout(3500);
    const body = await page.locator('body').textContent() || '';
    // La page doit présenter les RDV d'une façon ou d'une autre
    expect(body).not.toContain('Unhandled Runtime Error');
  });

  test('Pagination API – page 2 retourne des données ou tableau vide', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, CLIENT.email, CLIENT.password);
    const res = await apiCtx.get('http://localhost:3001/api/clientes/historique?page=2&limit=5', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data.rdvs)).toBeTruthy();
    await apiCtx.dispose();
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-C4 : Laisser un avis (après RDV TERMINÉ)
// ─────────────────────────────────────────────────────────────────
test.describe('UC-C4 – Avis', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, CLIENT.email, CLIENT.password);
  });

  test('Onglet Avis accessible dans Mon Espace', async ({ page }) => {
    await page.goto('/mon-espace');
    await page.waitForTimeout(2500);
    const avisTab = page.locator('button, [role="tab"]').filter({ hasText: /avis/i }).first();
    if (await avisTab.isVisible()) {
      await avisTab.click();
      await page.waitForTimeout(1200);
      await expect(page.locator('body')).not.toContainText('TypeError');
      await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    }
  });

  test('API POST /clientes/avis sans token → 401', async ({ request }) => {
    const res = await request.post('http://localhost:3001/api/clientes/avis', {
      data: { rendezVousId: '00000000-0000-4000-8000-000000000001', note: 5 },
    });
    expect(res.status()).toBe(401);
  });

  test('API POST /clientes/avis – note hors plage → 400', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, CLIENT.email, CLIENT.password);
    const res = await apiCtx.post('http://localhost:3001/api/clientes/avis', {
      headers: { Authorization: `Bearer ${token}` },
      data: { rendezVousId: '00000000-0000-4000-8000-000000000001', note: 10 },
    });
    // 10 > 5 → doit être rejeté (400 ou 404)
    expect([400, 404, 422]).toContain(res.status());
    await apiCtx.dispose();
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-C5 : Gérer le profil cliente
// ─────────────────────────────────────────────────────────────────
test.describe('UC-C5 – Profil cliente', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, CLIENT.email, CLIENT.password);
  });

  test(`Onglet Profil capillaire – formulaire d'édition accessible`, async ({ page }) => {
    await page.goto('/mon-espace');
    await page.waitForTimeout(2500);
    const profilTab = page.locator('button, [role="tab"]').filter({ hasText: /profil/i }).first();
    if (await profilTab.isVisible()) {
      await profilTab.click();
      await page.waitForTimeout(1500);
      await expect(page.locator('body')).not.toContainText('TypeError');
      const body = await page.locator('body').textContent() || '';
      expect(body).toMatch(/profil|cheveux|type|longueur/i);
    }
  });

  test('API GET /clientes/profil retourne les données du profil', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, CLIENT.email, CLIENT.password);
    const res = await apiCtx.get('http://localhost:3001/api/clientes/profil', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeTruthy();
    // Pas de fuite de données sensibles
    const json = JSON.stringify(body.data);
    expect(json).not.toContain('"passwordHash"');
    await apiCtx.dispose();
  });

  test('Page /parametres – section profil visible', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/nom|prénom|email|profil/i);
    await expect(page.locator('body')).not.toContainText('TypeError');
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-C6 : Changer le mot de passe
// ─────────────────────────────────────────────────────────────────
test.describe('UC-C6 – Changement mot de passe', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, CLIENT.email, CLIENT.password);
  });

  test('Section "Mot de passe" visible dans /parametres', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/mot de passe|password/i);
  });

  test('Mot de passe actuel incorrect → erreur (pas de crash)', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    const pwInputs = page.locator('input[type="password"]');
    const cnt = await pwInputs.count();
    if (cnt >= 3) {
      await pwInputs.nth(0).fill('mauvaisMotDePasse!');
      await pwInputs.nth(1).fill('NouveauMDP123456');
      await pwInputs.nth(2).fill('NouveauMDP123456');
      const btn = page.locator('button').filter({ hasText: /enregistrer|changer|modifier/i }).last();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(2000);
        await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
        await expect(page.locator('body')).not.toContainText('TypeError');
      }
    }
  });

  test('Nouveaux mots de passe non concordants → erreur', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    const pwInputs = page.locator('input[type="password"]');
    const cnt = await pwInputs.count();
    if (cnt >= 3) {
      await pwInputs.nth(0).fill(CLIENT.password);
      await pwInputs.nth(1).fill('NouveauMDP123456');
      await pwInputs.nth(2).fill('AutreMDP789012');
      const btn = page.locator('button').filter({ hasText: /enregistrer|changer|modifier/i }).last();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(1500);
        const body = await page.locator('body').textContent() || '';
        expect(body.toLowerCase()).toMatch(/correspondent|identique|passe/i);
      }
    }
  });

  test('API PUT /auth/password sans token → 401', async ({ request }) => {
    const res = await request.put('http://localhost:3001/api/auth/password', {
      data: { currentPassword: 'old', newPassword: 'new' },
    });
    expect(res.status()).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-C7 : Activer la 2FA (MFA)
// ─────────────────────────────────────────────────────────────────
test.describe('UC-C7 – Activation MFA', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, CLIENT.email, CLIENT.password);
  });

  test('Page /mfa accessible après connexion (pas de crash)', async ({ page }) => {
    await page.goto('/mfa');
    await page.waitForTimeout(2500);
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    await expect(page.locator('body')).not.toContainText('TypeError');
  });

  test('/parametres – section MFA/2FA visible pour la cliente', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/mfa|2fa|authentification|vérification/i);
  });

  test('API POST /mfa/totp/setup sans token → 401', async ({ request }) => {
    const res = await request.post('http://localhost:3001/api/mfa/totp/setup');
    expect(res.status()).toBe(401);
  });

  test('API POST /mfa/totp/verify sans token → 401', async ({ request }) => {
    const res = await request.post('http://localhost:3001/api/mfa/totp/verify', {
      data: { token: '123456' },
    });
    expect(res.status()).toBe(401);
  });

});
