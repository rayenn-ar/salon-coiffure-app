import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import {
  generateAccessToken,
  generateRefreshToken,
  generateOtpToken,
  hashToken,
  getRefreshTokenExpiry,
} from '../utils/jwt';
import { redisSet } from '../config/redis';

// ─── Dev-only: test session bypass ────────────────────────────────
// Provides a fully-authenticated admin session (mfaVerified: true)
// so that e2e tests can reach admin routes without going through
// the MFA setup/verification flow.
// NEVER registered in production.

const router = Router();

router.post('/admin-session', async (req: Request, res: Response): Promise<void> => {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    include: { admin: true },
  });

  if (!admin) {
    res.status(404).json({ error: 'Admin user not found in database' });
    return;
  }

  const sessionId = crypto.randomUUID();
  const fingerprint = 'e2e-test-fingerprint';

  await redisSet(
    `session:${sessionId}`,
    JSON.stringify({ userId: admin.id, role: 'ADMIN', fingerprint }),
    15 * 60
  );

  const accessToken = generateAccessToken({
    userId: admin.id,
    email: admin.email,
    role: 'ADMIN',
    pv: admin.passwordVersion,
    sessionId,
    mfaVerified: true,
    deviceFingerprint: fingerprint,
  });

  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: admin.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + getRefreshTokenExpiry()),
      deviceInfo: { userAgent: 'playwright-e2e', ip: '127.0.0.1' },
    },
  });

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: getRefreshTokenExpiry(),
  });

  res.json({ success: true, token: accessToken });
});

// ─── Dev-only: returns an OTP token for a given email without sending email ──
// Used by e2e tests to reach the /complete-registration step directly.
router.post('/otp-token', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: 'email required' });
    return;
  }
  const otpToken = generateOtpToken(email);
  res.json({ success: true, otpToken });
});

export default router;
