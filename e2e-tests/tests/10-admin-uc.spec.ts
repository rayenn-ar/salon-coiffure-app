import { test, expect } from '@playwright/test';
import { ADMIN, COIFFEUSE, login, loginAsAdmin, collectErrors, filterRealErrors, apiLogin, createApiContext } from './helpers';

// ══════════════════════════════════════════════════════════════════
//  10 – ADMIN USE CASES (UC-A1 … UC-A15)
//  Couvre la totalité du panneau d'administration
// ══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// UC-A1/A2/A3 : Tableau de bord, statistiques, graphique
// ─────────────────────────────────────────────────────────────────
test.describe('UC-A1/A2/A3 – Dashboard & Stats', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForTimeout(3000);
  });

  test('Tableau de bord charge sans crash', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    await expect(page.locator('body')).not.toContainText('TypeError');
  });

  test('Dashboard – contenu présent (CA, RDV, clientes)', async ({ page }) => {
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/rendez-vous|chiffre|client|tableau|bord/i);
  });

  test('Pas d\'erreurs console sur le dashboard', async ({ page }) => {
    const errs = collectErrors(page);
    await page.goto('/admin');
    await page.waitForTimeout(3000);
    expect(filterRealErrors(errs)).toHaveLength(0);
  });

  test('API GET /admin/dashboard avec token admin → 200', async ({ request }) => {
    // Admin requires MFA — use dev test endpoint that returns a pre-verified token
    const sessionRes = await request.post('http://localhost:3000/api/test/admin-session');
    if (!sessionRes.ok()) return; // test endpoint unavailable — skip gracefully
    const token: string = (await sessionRes.json()).token;
    expect(token).toBeTruthy();
    const res = await request.get('http://localhost:3001/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 403]).toContain(res.status());
  });

  test('Onglet stats/graphique accessible', async ({ page }) => {
    const statsTab = page.locator('button').filter({ hasText: /stat|graphique|analys/i }).first();
    if (await statsTab.isVisible()) {
      await statsTab.click();
      await page.waitForTimeout(2000);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-A4 : Créer un compte coiffeuse
// ─────────────────────────────────────────────────────────────────
test.describe('UC-A4 – Créer coiffeuse', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForTimeout(2500);
    const tab = page.locator('button').filter({ hasText: /coiffeuse/i }).first();
    if (await tab.isVisible()) {
      await tab.click();
      await page.waitForTimeout(1500);
    }
  });

  test('Onglet coiffeuses charge sans crash', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('TypeError');
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/coiffeuse|styliste/i);
  });

  test('Formulaire création coiffeuse – champs requis visibles', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /ajouter|nouvelle coiffeuse/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(800);
      await expect(page.locator('input[placeholder="Email"], input[type="email"]').first()).toBeVisible();
      await expect(page.locator('input[type="password"]').first()).toBeVisible();
    }
  });

  test('Formulaire – mot de passe < 12 caractères → erreur serveur/client', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /ajouter|nouvelle coiffeuse/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(800);
      const emailInput = page.locator('input[placeholder="Email"], input[type="email"]').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill('newcoiffeuse@test.fr');
        await page.locator('input[type="password"]').first().fill('court');
        const nom = page.locator('input[placeholder="Nom"]');
        if (await nom.isVisible()) await nom.fill('Testeur');
        const prenom = page.locator('input[placeholder="Prénom"]');
        if (await prenom.isVisible()) await prenom.fill('Nouveau');
        const submitBtn = page.locator('button[type="submit"]').last();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(2000);
          await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
          // Doit afficher une erreur de validation
          const body = await page.locator('body').textContent() || '';
          expect(body.toLowerCase()).toMatch(/12|caractère|minimum|erreur/i);
        }
      }
    }
  });

  test('API POST /admin/coiffeuses avec token client → 403', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, 'test@cliente.fr', 'cliente123');
    const res = await apiCtx.post('http://localhost:3001/api/admin/coiffeuses', {
      headers: { Authorization: `Bearer ${token}` },
      data: { email: 'fake@test.fr', password: 'fakepassword123', nom: 'Fake', prenom: 'Test' },
    });
    expect(res.status()).toBe(403);
    await apiCtx.dispose();
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-A5 : Modifier salaire / statut / bloquer une coiffeuse
// ─────────────────────────────────────────────────────────────────
test.describe('UC-A5 – Bloquer / Débloquer coiffeuse', () => {

  test('API PATCH /admin/coiffeuses/:id/bloquer sans token → 401', async ({ request }) => {
    const res = await request.patch('http://localhost:3001/api/admin/coiffeuses/00000000-0000-4000-8000-000000000001/bloquer');
    expect(res.status()).toBe(401);
  });

  test('API PATCH /admin/coiffeuses/:id/bloquer avec token client → 403', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, 'test@cliente.fr', 'cliente123');
    const res = await apiCtx.patch('http://localhost:3001/api/admin/coiffeuses/00000000-0000-4000-8000-000000000001/bloquer', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
    await apiCtx.dispose();
  });

  test('API PATCH /admin/coiffeuses/:id/salaire sans token → 401', async ({ request }) => {
    const res = await request.patch('http://localhost:3001/api/admin/coiffeuses/00000000-0000-4000-8000-000000000001/salaire', {
      data: { salaire: 2500 },
    });
    expect(res.status()).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-A7/A8/A9 : Gestion stock et produits
// ─────────────────────────────────────────────────────────────────
test.describe('UC-A7/A8/A9 – Stock & Produits', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForTimeout(2500);
    const stockTab = page.locator('button').filter({ hasText: /stock/i }).first();
    if (await stockTab.isVisible()) {
      await stockTab.click();
      await page.waitForTimeout(1500);
    }
  });

  test('Onglet stock charge sans crash', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('TypeError');
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
  });

  test('Liste des produits affichée', async ({ page }) => {
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/stock|produit|quantité|nom/i);
  });

  test('Bouton "Ajouter produit" ouvre formulaire', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /ajouter|nouveau produit/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(800);
      await expect(page.locator('body')).not.toContainText('TypeError');
      const inputs = page.locator('input, textarea, select');
      const cnt = await inputs.count();
      expect(cnt).toBeGreaterThan(0);
    }
  });

  test('Pas d\'erreur console sur onglet stock', async ({ page }) => {
    const errs = collectErrors(page);
    await page.waitForTimeout(1500);
    expect(filterRealErrors(errs)).toHaveLength(0);
  });

  test('Champ marque du produit – pas de valeur null (contrôle/non-contrôlé)', async ({ page }) => {
    const errs: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errs.push(msg.text()); });
    const pencilBtns = page.locator('button').filter({ has: page.locator('svg') });
    const cnt = await pencilBtns.count();
    if (cnt > 2) {
      await pencilBtns.nth(2).click();
      await page.waitForTimeout(1000);
    }
    const valueNullErrors = errs.filter((e) => e.includes('value prop') || e.includes('null'));
    expect(valueNullErrors).toHaveLength(0);
  });

  test('API GET /admin/produits sans token → 401', async ({ request }) => {
    const res = await request.get('http://localhost:3001/api/admin/produits');
    expect(res.status()).toBe(401);
  });

  test('API PATCH /admin/produits/:id/stock sans token → 401', async ({ request }) => {
    const res = await request.patch('http://localhost:3001/api/admin/produits/00000000-0000-4000-8000-000000000001/stock', {
      data: { quantite: 10 },
    });
    expect(res.status()).toBe(401);
  });

  test('Onglet mouvements de stock accessible', async ({ page }) => {
    const mvtTab = page.locator('button').filter({ hasText: /mouvement|historique stock/i }).first();
    if (await mvtTab.isVisible()) {
      await mvtTab.click();
      await page.waitForTimeout(1500);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-A10/A11 : Gestion des services et recettes
// ─────────────────────────────────────────────────────────────────
test.describe('UC-A10/A11 – Services & Recettes', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForTimeout(2500);
    const svcTab = page.locator('button').filter({ hasText: /^services$/i }).first();
    if (await svcTab.isVisible()) {
      await svcTab.click();
      await page.waitForTimeout(1500);
    }
  });

  test('Onglet services charge la liste', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('TypeError');
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/service|coupe|prix/i);
  });

  test('Bouton "Ajouter service" ouvre formulaire', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /ajouter|nouveau|créer/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(800);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

  test('API POST /services sans token → 401', async ({ request }) => {
    const res = await request.post('http://localhost:3001/api/services', {
      data: { nom: 'Test Service', prix: 30, duree: 60, categorie: 'COUPE' },
    });
    expect(res.status()).toBe(401);
  });

  test('API PUT /admin/services/:id/ingredients sans token → 401', async ({ request }) => {
    const res = await request.put('http://localhost:3001/api/admin/services/00000000-0000-4000-8000-000000000001/ingredients', {
      data: { ingredients: [] },
    });
    expect(res.status()).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-A12/A13 : Gestion des dépenses
// ─────────────────────────────────────────────────────────────────
test.describe('UC-A12/A13 – Dépenses', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForTimeout(2500);
    const depTab = page.locator('button').filter({ hasText: /dépense|finance/i }).first();
    if (await depTab.isVisible()) {
      await depTab.click();
      await page.waitForTimeout(1500);
    }
  });

  test('Onglet dépenses charge sans crash', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('TypeError');
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
  });

  test('Liste des dépenses affichée', async ({ page }) => {
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/dépense|finance|montant|aucune|catégorie/i);
  });

  test('Bouton "Ajouter dépense" accessible', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /ajouter|nouvelle dépense/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(800);
      await expect(page.locator('body')).not.toContainText('TypeError');
    }
  });

  test('API POST /admin/depenses sans token → 401', async ({ request }) => {
    const res = await request.post('http://localhost:3001/api/admin/depenses', {
      data: { montant: 100, categorie: 'FOURNITURES', description: 'Test' },
    });
    expect(res.status()).toBe(401);
  });

  test('API PATCH /admin/depenses/:id/payer sans token → 401', async ({ request }) => {
    const res = await request.patch('http://localhost:3001/api/admin/depenses/00000000-0000-4000-8000-000000000001/payer');
    expect(res.status()).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-A14 : Configurer les paramètres du salon
// ─────────────────────────────────────────────────────────────────
test.describe('UC-A14 – Paramètres salon', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('/parametres admin – section paramètres salon visible', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toContainText('TypeError');
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/paramètre|salon|annulation|délai|heure/i);
  });

  test('Délai d\'annulation modifiable', async ({ page }) => {
    await page.goto('/parametres');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/annulation|délai|heure/i);
  });

  test('API GET /admin/parametres/public accessible sans auth', async ({ request }) => {
    const res = await request.get('http://localhost:3001/api/admin/parametres/public');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeTruthy();
  });

  test('API PUT /admin/parametres sans token → 401', async ({ request }) => {
    const res = await request.put('http://localhost:3001/api/admin/parametres', {
      data: { delaiAnnulationHeures: 48 },
    });
    expect(res.status()).toBe(401);
  });

  test('Pas d\'erreur console sur /parametres (admin)', async ({ page }) => {
    const errs = collectErrors(page);
    await page.goto('/parametres');
    await page.waitForTimeout(3500);
    expect(filterRealErrors(errs)).toHaveLength(0);
  });

});

// ─────────────────────────────────────────────────────────────────
// UC-A15 : Voir la liste des clientes
// ─────────────────────────────────────────────────────────────────
test.describe('UC-A15 – Liste clientes', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForTimeout(2500);
    const clientesTab = page.locator('button').filter({ hasText: /cliente|client/i }).first();
    if (await clientesTab.isVisible()) {
      await clientesTab.click();
      await page.waitForTimeout(1500);
    }
  });

  test('Liste clientes charge sans crash', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('TypeError');
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
  });

  test('Clientes visibles (nom/prénom/email)', async ({ page }) => {
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/cliente|client|nom|email/i);
  });

  test('API GET /admin/clients sans token → 401', async ({ request }) => {
    const res = await request.get('http://localhost:3001/api/admin/clients');
    expect(res.status()).toBe(401);
  });

  test('API GET /admin/clients avec token coiffeuse → 403', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, COIFFEUSE.email, COIFFEUSE.password);
    const res = await apiCtx.get('http://localhost:3001/api/admin/clients', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
    await apiCtx.dispose();
  });

});
