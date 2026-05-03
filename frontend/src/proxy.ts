import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_ROUTES = ['/admin', '/espace-pro', '/mon-espace', '/parametres'];
const ADMIN_ROUTES = ['/admin'];
const AUTH_ROUTES = ['/connexion', '/inscription'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get('access_token')?.value;

  let tokenPayload: { role?: string; mfaVerified?: boolean } | null = null;
  if (accessToken) {
    try {
      const parts = accessToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        tokenPayload = payload;
      }
    } catch {
      // Invalid token — treat as unauthenticated
    }
  }

  const isAuthenticated = !!tokenPayload;
  const isAdmin = tokenPayload?.role === 'ADMIN';
  const isMfaVerified = tokenPayload?.mfaVerified === true;

  // ═══ Redirect authenticated users away from auth pages ═══
  if (isAuthenticated && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    const redirectTo = isAdmin ? '/admin' : '/mon-espace';
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  // ═══ Protect routes requiring authentication ═══
  if (!isAuthenticated && PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    const loginUrl = new URL('/connexion', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ═══ Admin routes: require ADMIN role + MFA verified ═══
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/connexion', request.url));
    }
    // Admin must complete MFA verification before accessing admin pages
    if (!isMfaVerified) {
      return NextResponse.redirect(new URL('/mfa', request.url));
    }
  }

  // ═══ Security headers for all responses ═══
  const response = NextResponse.next();

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
