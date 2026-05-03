import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, verifyLegacyToken, JWTPayload } from '../utils/jwt';
import { redisGet, isRedisAvailable } from '../config/redis';
import prisma from '../config/database';

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  // 1. Try httpOnly cookie first, then Authorization header
  const token = req.cookies?.access_token || extractBearerToken(req);

  if (!token) {
    res.status(401).json({ success: false, error: 'Token manquant' });
    return;
  }

  try {
    // Try RS256 first
    let decoded: JWTPayload;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      // Fallback: try legacy HS256 token (migration period)
      const legacy = verifyLegacyToken(token);
      if (!legacy) {
        res.status(401).json({ success: false, error: 'Token invalide ou expiré' });
        return;
      }
      // Legacy tokens don't have sessionId/mfaVerified — fill defaults
      decoded = {
        ...legacy,
        sessionId: 'legacy',
        mfaVerified: false,
      };
    }

    // 2. Verify user still active + password version matches
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { actif: true, passwordVersion: true },
    });

    if (!dbUser || !dbUser.actif || dbUser.passwordVersion !== decoded.pv) {
      res.status(401).json({ success: false, error: 'Session expirée, veuillez vous reconnecter' });
      return;
    }

    // 3. Verify Redis session (if sessionId is present and not legacy)
    // When Redis is unavailable, fall back to JWT-only mode (JWT signature + DB user check)
    if (decoded.sessionId && decoded.sessionId !== 'legacy' && isRedisAvailable()) {
      const sessionData = await redisGet(`session:${decoded.sessionId}`);
      if (!sessionData) {
        res.status(401).json({ success: false, error: 'Session expirée' });
        return;
      }
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token invalide ou expiré' });
  }
};

/**
 * Require MFA verification for admin routes.
 * Admins without MFA configured also fail this check — they must
 * configure MFA via /api/mfa/totp/setup before accessing admin routes.
 */
export const requireMfa = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Non authentifié' });
    return;
  }

  // Admin must have MFA verified (covers both: MFA not configured AND MFA pending verification)
  if (req.user.role === 'ADMIN' && !req.user.mfaVerified) {
    res.status(403).json({
      success: false,
      error: 'Vérification MFA requise',
      mfaRequired: true,
    });
    return;
  }

  next();
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Accès non autorisé' });
      return;
    }
    next();
  };
};

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}
