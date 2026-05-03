import { Page, APIRequestContext, request } from '@playwright/test';

export const ADMIN    = { email: 'admin@salon-beaute.fr',  password: 'admin12345'   };
export const COIFFEUSE = { email: 'fatima@salon-beaute.fr', password: 'coiffeuse123' };
export const CLIENT   = { email: 'test@cliente.fr',         password: 'cliente123'   };

export const API_URL = 'http://localhost:3001/api';

// ─── Browser helpers ────────────────────────────────────────────

export async function login(page: Page, email: string, password: string) {
  await page.goto('/connexion');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[type="email"]').waitFor({ state: 'visible' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/connexion'), { timeout: 20000 });
}

/**
 * Admin login with mfaVerified=true via dev-only test endpoint.
 * Sets auth cookies (for proxy routing) AND populates Zustand localStorage
 * (for client-side auth checks in React components).
 */
export async function loginAsAdmin(page: Page) {
  // Navigate to the frontend origin first so localStorage writes go to localhost:3000
  const currentUrl = page.url();
  if (!currentUrl.startsWith('http://localhost:3000')) {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  }

  // Cookies must be set via localhost:3000 so they're sent on subsequent navigations
  const res = await page.request.post('http://localhost:3000/api/test/admin-session');
  if (!res.ok()) {
    throw new Error(`Test admin-session endpoint failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const token: string = body.token;

  // Decode JWT payload (no verification needed — we just issued it)
  const payloadB64 = token.split('.')[1];
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

  // Populate the Zustand auth store in localStorage (key: 'auth-salon')
  // so that React components that read `token` from the store don't redirect to /connexion
  await page.evaluate(
    ({ tokenStr, userId, email, role }) => {
      const store = {
        state: {
          user: {
            id: userId,
            email,
            role,
            nom: 'Direction',
            prenom: 'Salon',
            isMfaEnabled: true,
            mfaMethod: 'totp',
          },
          token: tokenStr,
          refreshToken: null,
          isAuthenticated: true,
        },
        version: 0,
      };
      localStorage.setItem('auth-salon', JSON.stringify(store));
    },
    { tokenStr: token, userId: payload.userId, email: payload.email, role: payload.role }
  );
}

export async function logout(page: Page) {
  await page.goto('/');
}

// ─── API helpers (for security / backend tests) ─────────────────

/** Obtain a Bearer token via the API (bypasses UI). */
export async function apiLogin(
  apiContext: APIRequestContext,
  email: string,
  password: string
): Promise<string | null> {
  const res = await apiContext.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) return null;
  const body = await res.json();
  return body?.data?.accessToken ?? body?.data?.token ?? body?.accessToken ?? body?.token ?? null;
}

/** Create a fresh API request context. */
export async function createApiContext(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: API_URL });
}

/** Expect that a tab with matching text becomes visible within timeout. */
export async function expectTabVisible(page: Page, textRegex: RegExp, timeout = 10000) {
  await page.locator('button, [role="tab"]').filter({ hasText: textRegex }).first()
    .waitFor({ state: 'visible', timeout });
}

/** Collect JS console errors on a page, filtering out benign ones. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

export function filterRealErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('net::ERR') &&
      !e.includes('Failed to load resource') &&
      !e.includes('ERR_CONNECTION_REFUSED')
  );
}
