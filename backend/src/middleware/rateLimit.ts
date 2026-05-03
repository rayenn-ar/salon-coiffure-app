import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import redis from '../config/redis';

const isProd = process.env.NODE_ENV === 'production';

// Creates a Redis limiter with automatic memory fallback on Redis errors.
// The insuranceLimiter option makes rate-limiter-flexible transparently
// switch to memory when Redis is unreachable — no connection errors bubble up.
function createLimiter(opts: {
  keyPrefix: string;
  points: number;
  duration: number;  // seconds
  blockDuration?: number;  // seconds
}): RateLimiterRedis {
  const memFallback = new RateLimiterMemory({
    keyPrefix: opts.keyPrefix,
    points: opts.points,
    duration: opts.duration,
    blockDuration: opts.blockDuration || 0,
  });

  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: opts.keyPrefix,
    points: opts.points,
    duration: opts.duration,
    blockDuration: opts.blockDuration || 0,
    insuranceLimiter: memFallback,  // ← failover automatique si Redis KO
  });
}

// ==================== Rate Limiters ====================

// Login: 5 attempts / 15 min / IP+email (relaxed in dev/test to avoid blocking E2E tests)
const loginLimiter = createLimiter({
  keyPrefix: 'rl_login',
  points: isProd ? 5 : 500,
  duration: 15 * 60,
  blockDuration: isProd ? 15 * 60 : 0,
});

// MFA verify: 3 attempts / hour → block 1h
const mfaLimiter = createLimiter({
  keyPrefix: 'rl_mfa',
  points: 3,
  duration: 60 * 60,
  blockDuration: 60 * 60,
});

// Password reset: 3 requests / hour / email
const passwordResetLimiter = createLimiter({
  keyPrefix: 'rl_pwd_reset',
  points: 3,
  duration: 60 * 60,
});

// Global API: 100 req/min prod, 1000 req/min dev
const globalLimiter = createLimiter({
  keyPrefix: 'rl_global',
  points: isProd ? 100 : 1000,
  duration: 60,
});

// OTP: 1 request per 60s per IP+email
const otpLimiter = createLimiter({
  keyPrefix: 'rl_otp',
  points: 1,
  duration: parseInt(process.env.OTP_RATE_LIMIT_SECONDS || '60', 10),
  blockDuration: parseInt(process.env.OTP_RATE_LIMIT_SECONDS || '60', 10),
});

// ==================== Middleware Factories ====================

function getKey(req: Request, suffix?: string): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return suffix ? `${ip}_${suffix}` : ip;
}

// RateLimiterRes is thrown (not an Error) when limit is exceeded.
// Any actual Error means a technical problem → let the request through.
function isRateLimitExceeded(err: unknown): boolean {
  return err !== null && typeof err === 'object' && !(err instanceof Error);
}

export function rateLimitLogin() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = getKey(req, req.body?.email?.toLowerCase());
    try {
      await loginLimiter.consume(key);
      next();
    } catch (err) {
      if (isRateLimitExceeded(err)) {
        res.status(429).json({
          success: false,
          error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
        });
      } else {
        next();
      }
    }
  };
}

export function rateLimitMfa() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = getKey(req, (req as any).user?.userId);
    try {
      await mfaLimiter.consume(key);
      next();
    } catch (err) {
      if (isRateLimitExceeded(err)) {
        res.status(429).json({
          success: false,
          error: 'Trop de tentatives MFA. Compte temporairement bloqué (1h).',
        });
      } else {
        next();
      }
    }
  };
}

export function rateLimitPasswordReset() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await passwordResetLimiter.consume(
        getKey(req, req.body?.email?.toLowerCase()),
      );
    } catch {
      // Silent fail (anti-enumeration) — always pass through
    }
    next();
  };
}

export function rateLimitGlobal() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await globalLimiter.consume(getKey(req));
      next();
    } catch (err) {
      if (isRateLimitExceeded(err)) {
        res.status(429).json({
          success: false,
          error: 'Trop de requêtes. Veuillez réessayer plus tard.',
        });
      } else {
        next();
      }
    }
  };
}

export function rateLimitOtp() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const email = (req.body?.email as string | undefined)?.toLowerCase() ?? '';
    const key = getKey(req, email);
    try {
      await otpLimiter.consume(key);
      next();
    } catch (err) {
      if (isRateLimitExceeded(err)) {
        res.status(429).json({
          success: false,
          error: 'Veuillez attendre 60 secondes avant de demander un nouveau code.',
        });
      } else {
        next();
      }
    }
  };
}
