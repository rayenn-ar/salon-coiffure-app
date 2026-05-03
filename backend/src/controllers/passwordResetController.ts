import { Request, Response } from 'express';
import crypto from 'crypto';
import argon2 from 'argon2';
import prisma from '../config/database';
import { hashToken } from '../utils/jwt';
import { redisSet, redisGet, redisDel } from '../config/redis';
import { auditLog } from '../utils/audit';
import { sendSuccess, sendError } from '../utils/responses';

const RESET_TOKEN_TTL = 900; // 15 minutes

// ==================== POST /api/auth/forgot-password ====================

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    // Always return same success message (anti-enumeration)
    const genericMessage = 'Si cet email est associé à un compte, un lien de réinitialisation a été envoyé.';

    if (!email) {
      sendSuccess(res, { message: genericMessage });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      // Silent fail — same response
      await auditLog({ action: 'PASSWORD_RESET_REQUEST', resource: email, req, success: false });
      sendSuccess(res, { message: genericMessage });
      return;
    }

    // Generate token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL * 1000);

    // Invalidate any existing reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Store in DB
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Also store in Redis for fast lookup
    await redisSet(`pwd_reset:${user.id}`, tokenHash, RESET_TOKEN_TTL);

    // Construct reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}&uid=${user.id}`;

    // TODO: Send email in production
    console.log(`📧 [DEV] Password reset for ${user.email}: ${resetUrl}`);
    console.log(`   IP: ${req.ip}, UA: ${req.headers['user-agent']}`);

    await auditLog({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUEST',
      req,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    });

    sendSuccess(res, { message: genericMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    sendSuccess(res, { message: 'Si cet email est associé à un compte, un lien de réinitialisation a été envoyé.' });
  }
};

// ==================== GET /api/auth/verify-reset-token ====================

export const verifyResetToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, uid } = req.query;

    if (!token || !uid || typeof token !== 'string' || typeof uid !== 'string') {
      sendError(res, 'Paramètres invalides', 400);
      return;
    }

    const tokenHash = hashToken(token);

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: uid,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      sendError(res, 'Lien de réinitialisation invalide ou expiré', 400);
      return;
    }

    sendSuccess(res, { valid: true });
  } catch (error) {
    sendError(res, 'Erreur de vérification', 500);
  }
};

// ==================== POST /api/auth/reset-password ====================

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, uid, newPassword } = req.body;

    if (!token || !uid || !newPassword) {
      sendError(res, 'Paramètres manquants', 400);
      return;
    }

    // Validate password strength
    if (newPassword.length < 12) {
      sendError(res, 'Le mot de passe doit comporter au moins 12 caractères', 400);
      return;
    }

    const tokenHash = hashToken(token);

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: uid,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      sendError(res, 'Lien de réinitialisation invalide ou expiré', 400);
      return;
    }

    // Hash new password with Argon2id
    const hashedPassword = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      hashLength: 32,
    });

    // Update password, revoke all refresh tokens, mark reset token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: uid },
        data: {
          password: hashedPassword,
          passwordVersion: { increment: 1 },
          mustChangePassword: false,
        },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: uid, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Cleanup Redis
    await redisDel(`pwd_reset:${uid}`);

    await auditLog({
      userId: uid,
      action: 'PASSWORD_RESET_SUCCESS',
      req,
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    });

    // TODO: Send confirmation email in production

    sendSuccess(res, { reset: true, message: 'Mot de passe réinitialisé avec succès.' });
  } catch (error) {
    console.error('Reset password error:', error);
    sendError(res, 'Erreur lors de la réinitialisation', 500);
  }
};
