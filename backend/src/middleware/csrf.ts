import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Double Submit Cookie CSRF protection.
 * - Sets a CSRF token in a non-httpOnly cookie (readable by JS).
 * - Validates that mutating requests include the token in header.
 */
export function csrfProtection() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Ensure CSRF cookie exists
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      const token = crypto.randomBytes(32).toString('hex');
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Must be readable by JavaScript
        secure: isProd,
        sameSite: isProd ? 'strict' : 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000, // 24h
      });
      // Also set it for the current request
      if (!req.cookies) req.cookies = {};
      req.cookies[CSRF_COOKIE_NAME] = token;
    }

    // Safe methods don't need CSRF validation
    if (SAFE_METHODS.includes(req.method)) {
      return next();
    }

    // Skip CSRF for auth endpoints (login, register) — they don't have a session yet
    if (req.path.startsWith('/auth/login') || req.path.startsWith('/auth/register')) {
      return next();
    }

    // Validate CSRF token: header must match cookie
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

    if (!cookieToken || !headerToken || !crypto.timingSafeEqual(
      Buffer.from(cookieToken, 'utf8'),
      Buffer.from(headerToken, 'utf8')
    )) {
      res.status(403).json({
        success: false,
        error: 'CSRF token invalide ou manquant',
      });
      return;
    }

    next();
  };
}
