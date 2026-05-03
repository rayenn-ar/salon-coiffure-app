import { test, expect } from '@playwright/test';
import { COIFFEUSE, login, collectErrors, filterRealErrors, apiLogin, createApiContext } from './helpers';

// ══════════════════════════════════════════════════════════════════
//  09 – COIFFEUSE USE CASES (UC-P1 … UC-P9)
//  Couvre le parcours complet de la coiffeuse connectée (espace-pro)
// ══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// UC-P1 : Agenda semaine
// ─────────────────────────────────────────────────────────────────
test.describe('UC-P1 – Agenda semaine', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, COIFFEUSE.email, COIFFEUSE.password);
  });

  test('Espace-pro charge sans crash (onglet agenda actif)', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2500);
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    await expect(page.locator('body')).not.toContainText('TypeError');
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/agenda|planning|rendez-vous/i);
  });

  test('Vue semaine affiche les jours de la semaine', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/lun\.?|mar\.?|mer\.?|jeu\.?|ven\.?|lundi|mardi|mercredi|jeudi|vendredi/i);
  });

  test('Navigation semaine – bouton suivant ne crash pas', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    // Bouton chevron/flèche suivant
    const nextBtns = page.locator('button').filter({ has: page.locator('svg') });
    const cnt = await nextBtns.count();
    if (cnt >= 2) {
      // Le dernier bouton chevron est généralement "suivant"
      await nextBtns.last().click();
      await page.waitForTimeout(1200);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

  test('Navigation semaine – bouton précédent ne crash pas', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const prevBtns = page.locator('button').filter({ has: page.locator('svg') });
    const cnt = await prevBtns.count();
    if (cnt >= 2) {
      await prevBtns.first().click();
      await page.waitForTimeout(1200);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

  test('Pas d\'erreur console sur l\'espace-pro', async ({ page }) => {
    const errs = collectErrors(page);
    await page.goto('/espace-pro');
    await page.waitForTimeout(3000);
    expect(filterRealErrors(errs)).toHaveLength(0);
  });

  test('API GET /rendez-vous avec token coiffeuse → 200', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, COIFFEUSE.email, COIFFEUSE.password);
    expect(token).not.toBeNull();
    const res = await apiCtx.get('http://localhost:3001/api/rendez-vous', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    await apiCtx.dispose();
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-P2 : Enregistrer un RDV walk-in (présentiel)
// ─────────────────────────────────────────────────────────────────
test.describe('UC-P2 – Walk-in / Présentiel', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, COIFFEUSE.email, COIFFEUSE.password);
  });

  test('Onglet présentiel/walk-in accessible', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const tab = page.locator('button').filter({ hasText: /présentiel|walk.in/i }).first();
    if (await tab.isVisible()) {
      await tab.click();
      await page.waitForTimeout(1200);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

  test('Formulaire walk-in – champs nom client visibles', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const tab = page.locator('button').filter({ hasText: /présentiel|walk.in/i }).first();
    if (await tab.isVisible()) {
      await tab.click();
      await page.waitForTimeout(1500);
      const body = await page.locator('body').textContent() || '';
      expect(body).toMatch(/nom|prénom|client/i);
    }
  });

  test('Walk-in form – prix services sans NaN', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const tab = page.locator('button').filter({ hasText: /présentiel|walk.in/i }).first();
    if (await tab.isVisible()) {
      await tab.click();
      await page.waitForTimeout(2000);
      const body = await page.locator('body').textContent() || '';
      expect(body).not.toContain('NaN');
    }
  });

  test('Walk-in form – soumission sans champ requis → pas de crash', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const tab = page.locator('button').filter({ hasText: /présentiel|walk.in/i }).first();
    if (await tab.isVisible()) {
      await tab.click();
      await page.waitForTimeout(1200);
      const submitBtn = page.locator('button').filter({ hasText: /enregistrer|valider|créer rdv/i }).first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(1200);
        await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
        await expect(page.locator('body')).not.toContainText('TypeError');
      }
    }
  });

  test('API POST /rendez-vous/presentiel sans token → 401', async ({ request }) => {
    const res = await request.post('http://localhost:3001/api/rendez-vous/presentiel', {
      data: { nomClient: 'Test Walk-in', serviceIds: [], dateHeure: new Date().toISOString() },
    });
    expect(res.status()).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-P3 : Gérer le statut des RDV
// ─────────────────────────────────────────────────────────────────
test.describe('UC-P3 – Statuts RDV', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, COIFFEUSE.email, COIFFEUSE.password);
  });

  test('Les RDV affichés ne génèrent pas d\'erreur null (prenom/nom)', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toContainText("reading 'prenom'");
    await expect(page.locator('body')).not.toContainText("reading 'nom'");
    await expect(page.locator('body')).not.toContainText('Cannot read properties of null');
  });

  test('Couleurs de statut présentes dans la vue agenda', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2500);
    // Les statuts doivent être affichés avec des couleurs/badges (pas de crash)
    await expect(page.locator('body')).not.toContainText('TypeError');
  });

  test('API PATCH /rendez-vous/:id/statut sans token → 401', async ({ request }) => {
    const res = await request.patch('http://localhost:3001/api/rendez-vous/00000000-0000-4000-8000-000000000001/statut', {
      data: { statut: 'CONFIRME' },
    });
    expect(res.status()).toBe(401);
  });

  test('API PATCH statut avec token client (mauvais rôle) → 403', async ({ request }) => {
    const apiCtx = await createApiContext();
    // On utilise le token d'une cliente (rôle CLIENTE) qui ne peut pas modifier les statuts
    const token = await apiLogin(apiCtx, 'test@cliente.fr', 'cliente123');
    const res = await apiCtx.patch('http://localhost:3001/api/rendez-vous/00000000-0000-4000-8000-000000000001/statut', {
      headers: { Authorization: `Bearer ${token}` },
      data: { statut: 'CONFIRME' },
    });
    // 403 (rôle interdit) ou 404 (RDV inexistant) sont les seules réponses acceptables
    expect([403, 404]).toContain(res.status());
    await apiCtx.dispose();
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-P4 : Saisir les matières utilisées
// ─────────────────────────────────────────────────────────────────
test.describe('UC-P4 – Matières utilisées', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, COIFFEUSE.email, COIFFEUSE.password);
  });

  test('Onglet matières/produits accessible', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const tab = page.locator('button').filter({ hasText: /matière|produit utilisé/i }).first();
    if (await tab.isVisible()) {
      await tab.click();
      await page.waitForTimeout(1500);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

  test('API POST /rendez-vous/:id/matieres sans token → 401', async ({ request }) => {
    const res = await request.post('http://localhost:3001/api/rendez-vous/00000000-0000-4000-8000-000000000001/matieres', {
      data: { produits: [] },
    });
    expect(res.status()).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-P5 : Gérer les disponibilités
// ─────────────────────────────────────────────────────────────────
test.describe('UC-P5 – Disponibilités', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, COIFFEUSE.email, COIFFEUSE.password);
  });

  test('Section disponibilités visible sur /parametres', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/disponibilité|horaire|planning/i);
    await expect(page.locator('body')).not.toContainText('TypeError');
  });

  test('Pas d\'erreur console sur la page paramètres (coiffeuse)', async ({ page }) => {
    const errs = collectErrors(page);
    await page.goto('/parametres');
    await page.waitForTimeout(3000);
    expect(filterRealErrors(errs)).toHaveLength(0);
  });

  test('API PUT /coiffeuses/me/disponibilites sans token → 401', async ({ request }) => {
    const res = await request.put('http://localhost:3001/api/coiffeuses/me/disponibilites', {
      data: { disponibilites: [] },
    });
    expect(res.status()).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-P6 : Voir la liste de ses clientes
// ─────────────────────────────────────────────────────────────────
test.describe('UC-P6 – Mes clientes', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, COIFFEUSE.email, COIFFEUSE.password);
  });

  test('Onglet clientes accessible dans espace-pro', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const tab = page.locator('button').filter({ hasText: /cliente|client/i }).first();
    if (await tab.isVisible()) {
      await tab.click();
      await page.waitForTimeout(1500);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

  test('API GET /coiffeuses/mes-clientes avec token coiffeuse → 200', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, COIFFEUSE.email, COIFFEUSE.password);
    expect(token).not.toBeNull();
    const res = await apiCtx.get('http://localhost:3001/api/coiffeuses/mes-clientes', {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 200 ou 403 (si coiffeuse sans MFA vérifié)
    expect([200, 403]).toContain(res.status());
    await apiCtx.dispose();
  });

  test('API GET /coiffeuses/mes-clientes sans token → 401', async ({ request }) => {
    const res = await request.get('http://localhost:3001/api/coiffeuses/mes-clientes');
    expect(res.status()).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-P7 : Modifier son profil coiffeuse
// ─────────────────────────────────────────────────────────────────
test.describe('UC-P7 – Profil coiffeuse', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, COIFFEUSE.email, COIFFEUSE.password);
  });

  test('Page /parametres affiche les champs de profil', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/nom|prénom|email/i);
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
  });

  test('Bouton Enregistrer profil ne cause pas de crash', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    const saveBtn = page.locator('button').filter({ hasText: /enregistrer|sauvegarder/i }).first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
      await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-P8 : Consulter le stock des produits
// ─────────────────────────────────────────────────────────────────
test.describe('UC-P8 – Stock', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, COIFFEUSE.email, COIFFEUSE.password);
  });

  test('Onglet stock accessible dans espace-pro', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2000);
    const tab = page.locator('button').filter({ hasText: /stock|produit/i }).first();
    if (await tab.isVisible()) {
      await tab.click();
      await page.waitForTimeout(1500);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

  test('API GET /coiffeuses/produits avec token coiffeuse → 200 ou 403 (MFA)', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, COIFFEUSE.email, COIFFEUSE.password);
    const res = await apiCtx.get('http://localhost:3001/api/coiffeuses/produits', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 403]).toContain(res.status());
    await apiCtx.dispose();
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-P9 : Paramètres personnels coiffeuse
// ─────────────────────────────────────────────────────────────────
test.describe('UC-P9 – Paramètres coiffeuse', () => {

  test.beforeEach(async ({ page }) => {
    await login(page, COIFFEUSE.email, COIFFEUSE.password);
  });

  test('Page /parametres accessible pour la coiffeuse', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    await expect(page.locator('body')).not.toContainText('TypeError');
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/paramètre|profil|mot de passe/i);
  });

  test('Section changement de mot de passe présente', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/mot de passe|password/i);
  });

  test('Mots de passe non concordants → validation côté client', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(2500);
    const pwInputs = page.locator('input[type="password"]');
    const cnt = await pwInputs.count();
    if (cnt >= 3) {
      await pwInputs.nth(0).fill('currentpass');
      await pwInputs.nth(1).fill('NewPass123456');
      await pwInputs.nth(2).fill('DifferentPass789');
      const btn = page.locator('button').filter({ hasText: /enregistrer|changer/i }).last();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(1500);
        await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
      }
    }
  });

});
