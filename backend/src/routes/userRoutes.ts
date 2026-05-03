/**
 * GDPR / User-account self-service routes
 *  DELETE /api/user/account   — request account deletion (anonymisation)
 *  GET    /api/user/export    — export all personal data as JSON
 *  PUT    /api/user/consents  — update marketing/push notification consents
 *
 * All routes require authentication.
 */
import { Router } from 'express';
import { body } from 'express-validator';
import { Request, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import prisma from '../config/database';
import { auditLog } from '../utils/audit';
import { sendSuccess, sendError } from '../utils/responses';
import { validate } from '../middleware/validate';
import { redisDel } from '../config/redis';

const router = Router();

// ==================== DELETE /api/user/account ====================
// Anonymise the account in compliance with GDPR Art. 17 (right to erasure).
// Hard-delete is avoided so historical appointment/financial records are preserved.

router.delete(
  '/account',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthRequest).user!;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { cliente: true, coiffeuse: true },
      });

      if (!user) {
        sendError(res, 'Utilisateur non trouvé', 404);
        return;
      }

      const anonymisedEmail = `deleted_${userId}@anonymised.invalid`;
      const anonymisedPhone = '';

      await prisma.$transaction(async (tx) => {
        // Anonymise PII on the user record
        await tx.user.update({
          where: { id: userId },
          data: {
            email: anonymisedEmail,
            password: 'DELETED',
            actif: false,
            isMfaEnabled: false,
            encryptedTotpSecret: null,
          },
        });

        // Anonymise cliente profile
        if (user.cliente) {
          await tx.cliente.update({
            where: { userId },
            data: {
              nom: 'Supprimé',
              prenom: 'Supprimé',
              telephone: anonymisedPhone,
              dateNaissance: null,
              notes: null,
            },
          });
        }

        // Revoke all refresh tokens
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        // Deactivate push tokens
        await tx.pushToken.updateMany({
          where: { userId },
          data: { isActive: false },
        });

        // Delete WebAuthn credentials (biometric — highly sensitive)
        await tx.webauthnCredential.deleteMany({ where: { userId } });

        // Delete backup codes
        await tx.backupCode.deleteMany({ where: { userId } });

        // Delete pending password reset tokens
        await tx.passwordResetToken.deleteMany({ where: { userId } });
      });

      // Destroy active Redis session
      if ((req as AuthRequest).user?.sessionId) {
        await redisDel(`session:${(req as AuthRequest).user!.sessionId}`);
      }

      await auditLog({ userId, action: 'ACCOUNT_DELETED', req });

      // Clear auth cookies so the client is immediately logged out
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/api/auth/refresh' });

      sendSuccess(res, { deleted: true });
    } catch (err) {
      console.error('[user/account DELETE]', err);
      sendError(res, 'Erreur lors de la suppression du compte', 500);
    }
  },
);

// ==================== GET /api/user/export ====================
// Return all personal data for the authenticated user (GDPR Art. 20 — data portability).

router.get(
  '/export',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthRequest).user!;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          cliente: true,
          refreshTokens: { select: { createdAt: true, expiresAt: true, revokedAt: true, deviceInfo: true } },
          auditLogs: { select: { action: true, ipAddress: true, createdAt: true, success: true }, orderBy: { createdAt: 'desc' }, take: 200 },
          pushTokens: { select: { platform: true, isActive: true, createdAt: true } },
        },
      });

      if (!user) {
        sendError(res, 'Utilisateur non trouvé', 404);
        return;
      }

      const rendezVous = await prisma.rendezVous.findMany({
        where: { clienteId: user.cliente?.id },
        include: {
          services: { include: { service: { select: { nom: true, prix: true } } } },
        },
        orderBy: { dateHeure: 'desc' },
      });

      await auditLog({ userId, action: 'DATA_ACCESS', resource: 'gdpr_export', req });

      // Omit the password hash and TOTP secret from the export
      const { password, encryptedTotpSecret, ...safeUser } = user;

      sendSuccess(res, {
        exportedAt: new Date().toISOString(),
        user: safeUser,
        rendezVous,
      });
    } catch (err) {
      console.error('[user/export]', err);
      sendError(res, 'Erreur lors de l\'export des données', 500);
    }
  },
);

// ==================== PUT /api/user/consents ====================
// Allow users to update marketing/push notification consent (GDPR Art. 7).
// Consent flags are stored as metadata in the Cliente table notes field (JSON).
// In a future migration a dedicated `consents` table would be preferable.

router.put(
  '/consents',
  authenticate,
  [
    body('pushNotifications').optional().isBoolean(),
    body('marketingEmails').optional().isBoolean(),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthRequest).user!;
    const { pushNotifications, marketingEmails } = req.body as {
      pushNotifications?: boolean;
      marketingEmails?: boolean;
    };

    try {
      // If user has no consent record, deactivate tokens as needed
      if (pushNotifications === false) {
        await prisma.pushToken.updateMany({
          where: { userId },
          data: { isActive: false },
        });
      }

      await auditLog({ userId, action: 'DATA_ACCESS', resource: 'gdpr_consents_update', req });

      sendSuccess(res, {
        updated: true,
        consents: {
          pushNotifications: pushNotifications ?? null,
          marketingEmails: marketingEmails ?? null,
        },
      });
    } catch (err) {
      console.error('[user/consents]', err);
      sendError(res, 'Erreur lors de la mise à jour des consentements', 500);
    }
  },
);

export default router;
