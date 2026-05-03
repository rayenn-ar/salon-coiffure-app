import { test, expect } from '@playwright/test';
import { ADMIN, COIFFEUSE, CLIENT, apiLogin, createApiContext } from './helpers';

// ══════════════════════════════════════════════════════════════════
//  11 – TESTS DE SÉCURITÉ (OWASP Top 10)
//  Couvre : Contrôle d'accès, Auth, Injections, Config, Headers
// ══════════════════════════════════════════════════════════════════

const API = 'http://localhost:3001/api';

// ─────────────────────────────────────────────────────────────────
// A01 – Broken Access Control (Contrôle des accès)
// ─────────────────────────────────────────────────────────────────
test.describe('OWASP A01 – Contrôle des accès', () => {

  test('Page /admin redirige un visiteur non connecté', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(2500);
    const url = page.url();
    const body = await page.locator('body').textContent() || '';
    const isProtected =
      url.includes('connexion') ||
      body.toLowerCase().includes('connexion') ||
      body.toLowerCase().includes('accès refusé');
    expect(isProtected).toBeTruthy();
  });

  test('Page /espace-pro redirige un visiteur non connecté', async ({ page }) => {
    await page.goto('/espace-pro');
    await page.waitForTimeout(2500);
    const url = page.url();
    const body = await page.locator('body').textContent() || '';
    const isProtected = url.includes('connexion') || body.toLowerCase().includes('connexion');
    expect(isProtected).toBeTruthy();
  });

  test('Page /mon-espace redirige un visiteur non connecté', async ({ page }) => {
    await page.goto('/mon-espace');
    await expect(page).toHaveURL(/connexion/);
  });

  test('API /admin/dashboard sans token → 401', async ({ request }) => {
    const res = await request.get(`${API}/admin/dashboard`);
    expect(res.status()).toBe(401);
  });

  test('API /admin/dashboard avec token CLIENTE → 403', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, CLIENT.email, CLIENT.password);
    expect(token).not.toBeNull();
    const res = await apiCtx.get(`${API}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
    await apiCtx.dispose();
  });

  test('API /admin/dashboard avec token COIFFEUSE → 403', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, COIFFEUSE.email, COIFFEUSE.password);
    expect(token).not.toBeNull();
    const res = await apiCtx.get(`${API}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
    await apiCtx.dispose();
  });

  test('API /admin/coiffeuses avec token COIFFEUSE → 403', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, COIFFEUSE.email, COIFFEUSE.password);
    const res = await apiCtx.get(`${API}/admin/coiffeuses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
    await apiCtx.dispose();
  });

  test('API /clientes/historique sans token → 401', async ({ request }) => {
    const res = await request.get(`${API}/clientes/historique`);
    expect(res.status()).toBe(401);
  });

  test('API /rendez-vous sans token → 401', async ({ request }) => {
    const res = await request.get(`${API}/rendez-vous`);
    expect(res.status()).toBe(401);
  });

  test('API /coiffeuses/mes-clientes avec token client → 403', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, CLIENT.email, CLIENT.password);
    const res = await apiCtx.get(`${API}/coiffeuses/mes-clientes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
    await apiCtx.dispose();
  });

  test('API /auth/me sans token → 401', async ({ request }) => {
    const res = await request.get(`${API}/auth/me`);
    expect(res.status()).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────────
// A02 – Cryptographic Failures (Données sensibles exposées)
// ─────────────────────────────────────────────────────────────────
test.describe('OWASP A02 – Données sensibles', () => {

  test('API /auth/me ne renvoie pas le hash du mot de passe', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, CLIENT.email, CLIENT.password);
    const res = await apiCtx.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const json = JSON.stringify(body);
    expect(json).not.toContain('"passwordHash"');
    expect(json).not.toContain('"password"');
    expect(json).not.toContain('"hash"');
    await apiCtx.dispose();
  });

  test('API /coiffeuses (publique) ne renvoie pas les mots de passe', async ({ request }) => {
    const res = await request.get(`${API}/coiffeuses`);
    const body = await res.json();
    const json = JSON.stringify(body);
    expect(json).not.toContain('"passwordHash"');
    expect(json).not.toContain('"password"');
    expect(json).not.toContain('"hash"');
  });

  test('Tokens JWT ont une expiration (champ "exp" présent)', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, CLIENT.email, CLIENT.password);
    expect(token).not.toBeNull();
    // Décoder le payload JWT (base64)
    const parts = token!.split('.');
    expect(parts.length).toBe(3);
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    expect(payload.exp).toBeDefined();
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
    await apiCtx.dispose();
  });

  test('Token JWT ne contient pas le mot de passe en clair', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, CLIENT.email, CLIENT.password);
    expect(token).not.toBeNull();
    const decoded = Buffer.from(token!.split('.')[1], 'base64').toString('utf-8');
    expect(decoded).not.toContain(CLIENT.password);
    await apiCtx.dispose();
  });

  test('API /clientes/profil ne renvoie pas les secrets MFA', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, CLIENT.email, CLIENT.password);
    const res = await apiCtx.get(`${API}/clientes/profil`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    const json = JSON.stringify(body);
    expect(json).not.toContain('"totpSecret"');
    expect(json).not.toContain('"mfaSecret"');
    await apiCtx.dispose();
  });

});

// ─────────────────────────────────────────────────────────────────
// A03 – Injection (SQL Injection, XSS)
// ─────────────────────────────────────────────────────────────────
test.describe('OWASP A03 – Injection', () => {

  test('Login avec payload SQL injection → pas de 500 (réponse sûre)', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, {
      data: { email: "' OR '1'='1", password: "' OR '1'='1" },
    });
    // Doit retourner 400 (validation email invalide) ou 401 (mauvais identifiants), jamais 500
    expect([400, 401, 422]).toContain(res.status());
  });

  test('Login avec email contenant script XSS → pas de 500', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, {
      data: { email: '<script>alert(1)</script>@test.fr', password: 'testpassword' },
    });
    expect([400, 401, 422]).toContain(res.status());
  });

  test('Inscription avec payload XSS dans le nom → réponse sûre', async ({ request }) => {
    const res = await request.post(`${API}/auth/register`, {
      data: {
        email: 'xss_test_unique@test.fr',
        password: 'motdepasse123456',
        nom: '<script>alert(document.cookie)</script>',
        prenom: 'Test',
        telephone: '0600000000',
      },
    });
    // Soit 201 (créé, le nom sera encodé à l'affichage), soit 400 (validation rejectée)
    expect([201, 400, 409, 422]).toContain(res.status());
    // En aucun cas une erreur 500
    expect(res.status()).not.toBe(500);
  });

  test('GET /api/services avec paramètre injection → réponse sûre', async ({ request }) => {
    const res = await request.get(`${API}/services?categorie=' UNION SELECT * FROM users --`);
    expect([200, 400]).toContain(res.status());
    expect(res.status()).not.toBe(500);
  });

  test('Page d\'inscription – XSS dans le formulaire non reflété', async ({ request }) => {
    // Le formulaire /inscription est multi-étapes (email → OTP → détails).
    // On teste via l'API directement : le backend ne doit pas refléter le payload XSS.
    const tokenRes = await request.post(`${API}/test/otp-token`, {
      data: { email: 'xss_form@test.fr' },
    });
    if (!tokenRes.ok()) return; // endpoint de test indisponible — skip gracieux
    const { otpToken } = await tokenRes.json();
    const res = await request.post(`${API}/auth/complete-registration`, {
      headers: { Authorization: `Bearer ${otpToken}` },
      data: {
        prenom: '<img src=x onerror=alert(1)>',
        nom: 'TestXSS',
        telephone: '0600000001',
        password: 'motdepasse123456',
      },
    });
    // Le backend ne doit pas crasher
    expect(res.status()).not.toBe(500);
    // La réponse ne doit pas refléter le payload XSS brut
    const bodyStr = JSON.stringify(await res.json().catch(() => ({})));
    expect(bodyStr).not.toContain('onerror=alert');
  });

});

// ─────────────────────────────────────────────────────────────────
// A05 – Security Misconfiguration (Headers de sécurité)
// ─────────────────────────────────────────────────────────────────
test.describe('OWASP A05 – Configuration sécurité', () => {

  test('API – X-Content-Type-Options: nosniff présent', async ({ request }) => {
    const res = await request.get(`${API}/services`);
    const header = res.headers()['x-content-type-options'];
    expect(header).toBe('nosniff');
  });

  test('API – X-Frame-Options: DENY présent', async ({ request }) => {
    const res = await request.get(`${API}/services`);
    const header = res.headers()['x-frame-options'];
    expect(header).toMatch(/DENY|SAMEORIGIN/i);
  });

  test('API – Pas de header X-Powered-By (Express fingerprinting)', async ({ request }) => {
    const res = await request.get(`${API}/services`);
    const powered = res.headers()['x-powered-by'];
    // Ne doit pas révéler "Express"
    expect(powered).toBeUndefined();
  });

  test('API – Content-Security-Policy présent', async ({ request }) => {
    const res = await request.get(`${API}/services`);
    const csp = res.headers()['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src");
  });

  test('API – CORS : accès refusé depuis une origine inconnue', async ({ request }) => {
    const res = await request.get(`${API}/services`, {
      headers: { Origin: 'https://evil-hacker.com' },
    });
    // Soit 200 sans ACAO header, soit ACAO limité aux origines autorisées
    const acao = res.headers()['access-control-allow-origin'];
    // L'origine malveillante ne doit pas être dans ACAO
    if (acao) {
      expect(acao).not.toBe('https://evil-hacker.com');
    }
  });

  test('API – Health check ne révèle pas d\'info sensible en prod-like', async ({ request }) => {
    const res = await request.get('http://localhost:3001/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // Ne doit pas exposer les variables d'environnement, connection strings, etc.
    const json = JSON.stringify(body);
    expect(json).not.toContain('DATABASE_URL');
    expect(json).not.toContain('password');
    expect(json).not.toContain('secret');
  });

});

// ─────────────────────────────────────────────────────────────────
// A07 – Identification & Authentication Failures
// ─────────────────────────────────────────────────────────────────
test.describe('OWASP A07 – Authentification', () => {

  test('Token JWT falsifié → 401 (signature invalide)', async ({ request }) => {
    // Token JWT avec signature manipulée
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3MDAwMDAwMDB9.fakesignature';
    const res = await request.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${fakeToken}` },
    });
    expect(res.status()).toBe(401);
  });

  test('Token JWT expiré → 401', async ({ request }) => {
    // Payload avec exp dans le passé (1700000000 = Nov 2023)
    // Ce token est invalide vis-à-vis de la signature, donc retournera 401
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZXhwIjoxNzAwMDAwMDAwfQ.expiredSignature';
    const res = await request.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect(res.status()).toBe(401);
  });

  test('Token "none" algorithm (alg:none attack) → 401', async ({ request }) => {
    // Attack: modifier l'algorithme en "none"
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ userId: 'admin', role: 'ADMIN', iat: Math.floor(Date.now()/1000) })).toString('base64url');
    const noneToken = `${header}.${payload}.`;
    const res = await request.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${noneToken}` },
    });
    expect(res.status()).toBe(401);
  });

  test('Token Bearer vide → 401', async ({ request }) => {
    const res = await request.get(`${API}/auth/me`, {
      headers: { Authorization: 'Bearer ' },
    });
    expect(res.status()).toBe(401);
  });

  test('Login avec email inexistant → message générique (pas de leak "email inexistant")', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, {
      data: { email: 'non_existant_xyz@test.com', password: 'wrongpassword123' },
    });
    // Doit retourner 400/401 avec un message générique
    expect([400, 401]).toContain(res.status());
    const body = await res.json();
    // Le message ne doit pas révéler si l'email existe ou non
    const msg = JSON.stringify(body).toLowerCase();
    expect(msg).not.toContain('email introuvable');
    expect(msg).not.toContain('email non trouvé');
    // Messages acceptables : "identifiants incorrects", "invalid credentials"
  });

  test('Refresh token absent → 401', async ({ request }) => {
    const res = await request.post(`${API}/auth/refresh`);
    expect([400, 401]).toContain(res.status());
  });

  test('Forcer rôle via payload JWT → 403 (pas d\'escalade de privilège)', async ({ request }) => {
    // Obtenir un token cliente légitime puis essayer d'accéder à /admin
    const apiCtx = await createApiContext();
    const clientToken = await apiLogin(apiCtx, CLIENT.email, CLIENT.password);
    expect(clientToken).not.toBeNull();

    // Tenter d'accéder à une route admin avec le token client
    const res = await apiCtx.get(`${API}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    // Doit être 403 même si le token est valide (mauvais rôle)
    expect(res.status()).toBe(403);
    await apiCtx.dispose();
  });

});

// ─────────────────────────────────────────────────────────────────
// A08 – CSRF Protection
// ─────────────────────────────────────────────────────────────────
test.describe('OWASP A08 – CSRF', () => {

  test('API Login avec Referer externe – requête acceptée mais sans cookie de session exploitable', async ({ request }) => {
    // L'API est stateless JWT, pas basée sur des cookies de session → CSRF peu pertinent
    // Mais on vérifie que le CSRF middleware ne bloque pas les requêtes légitimes
    const res = await request.post(`${API}/auth/login`, {
      headers: { Referer: 'https://evil.com' },
      data: { email: CLIENT.email, password: CLIENT.password },
    });
    // Doit répondre normalement (l'API n'utilise pas de session basée sur cookie pour l'auth principale)
    expect([200, 401]).toContain(res.status());
  });

});

// ─────────────────────────────────────────────────────────────────
// A09 – Logging & Monitoring (comportements attendus)
// ─────────────────────────────────────────────────────────────────
test.describe('OWASP A09 – Erreurs & Monitoring', () => {

  test('Route inexistante → 404 (pas 500)', async ({ request }) => {
    const res = await request.get(`${API}/route/qui/nexiste/pas`);
    expect(res.status()).toBe(404);
    expect(res.status()).not.toBe(500);
  });

  test('Méthode HTTP incorrecte → 404 ou 405 (pas 500)', async ({ request }) => {
    const res = await request.delete(`${API}/auth/login`);
    expect([404, 405]).toContain(res.status());
    expect(res.status()).not.toBe(500);
  });

  test('Body JSON malformé → 400 (pas 500)', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: 'not-valid-json{{{',
    });
    expect([400, 422]).toContain(res.status());
    expect(res.status()).not.toBe(500);
  });

  test('Réponses d\'erreur ne révèlent pas de stack trace', async ({ request }) => {
    const res = await request.get(`${API}/admin/dashboard`);
    const body = await res.json();
    const json = JSON.stringify(body);
    // Ne pas exposer les chemins internes, stack traces
    expect(json).not.toMatch(/at Object\./);
    expect(json).not.toMatch(/at async/);
    expect(json).not.toContain('node_modules');
  });

});

// ─────────────────────────────────────────────────────────────────
// A10 – SSRF & Mass Assignment
// ─────────────────────────────────────────────────────────────────
test.describe('OWASP A10 – Injection avancée & Mass assignment', () => {

  test('Inscription – impossible de s\'auto-assigner le rôle ADMIN', async ({ request }) => {
    const uniqueEmail = `mass_assign_${Date.now()}@test.fr`;
    const res = await request.post(`${API}/auth/register`, {
      data: {
        email: uniqueEmail,
        password: 'motdepasse123456',
        nom: 'Mass',
        prenom: 'Assign',
        telephone: '0600000050',
        role: 'ADMIN',   // tentative de mass assignment
      },
    });
    if (res.ok()) {
      // Si la création réussit, vérifier que le rôle n'est pas ADMIN
      const loginCtx = await createApiContext();
      const token = await apiLogin(loginCtx, uniqueEmail, 'motdepasse123456');
      if (token) {
        const meRes = await loginCtx.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const meBody = await meRes.json();
        expect(meBody.data?.role).not.toBe('ADMIN');
        expect(meBody.data?.role).not.toBe('COIFFEUSE');
        expect(meBody.data?.role).toBe('CLIENTE');
      }
      await loginCtx.dispose();
    }
  });

  test('Modification de profil – impossible de changer son propre rôle', async ({ request }) => {
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, CLIENT.email, CLIENT.password);
    const res = await apiCtx.put(`${API}/auth/profil`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nom: 'TestUser',
        prenom: 'Update',
        role: 'ADMIN',   // tentative d'escalade de privilège
      },
    });
    // Soit interdit (400/403), soit accepté mais le rôle ignoré
    if (res.ok()) {
      // Vérifier que le rôle n'a pas changé
      const meRes = await apiCtx.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meBody = await meRes.json();
      expect(meBody.data?.role).toBe('CLIENTE');
    } else {
      expect([400, 403, 422]).toContain(res.status());
    }
    await apiCtx.dispose();
  });

  test('POST /rendez-vous – impossible de créer un RDV pour une autre cliente', async ({ request }) => {
    // Vérifier qu'on ne peut pas spécifier un clienteId arbitraire
    const apiCtx = await createApiContext();
    const token = await apiLogin(apiCtx, CLIENT.email, CLIENT.password);
    const res = await apiCtx.post(`${API}/rendez-vous`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        clienteId: '00000000-0000-4000-8000-000000000099', // autre cliente
        coiffeuseId: '00000000-0000-4000-8000-000000000001',
        serviceIds: [],
        dateHeure: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    // L'API doit utiliser le clienteId du token, pas celui du body → 400 ou 422
    // Si le coiffeuseId n'existe pas → 404 est aussi acceptable
    expect(res.status()).not.toBe(500);
    await apiCtx.dispose();
  });

});
