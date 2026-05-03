import { Router } from 'express';
import { body } from 'express-validator';
import { Request, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { registerPushToken, deactivatePushToken } from '../services/pushService';
import { validate } from '../middleware/validate';
import { sendSuccess, sendError } from '../utils/responses';

const router = Router();

// POST /api/push/register — save a FCM/Web push token for the authenticated user
router.post(
  '/register',
  authenticate,
  [
    body('token').notEmpty().withMessage('Token requis'),
    body('platform')
      .isIn(['web', 'android', 'ios', 'desktop'])
      .withMessage('Plateforme invalide'),
    body('deviceInfo').optional().isObject(),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthRequest).user!;
    const { token, platform, deviceInfo } = req.body as {
      token: string;
      platform: string;
      deviceInfo?: Record<string, unknown>;
    };

    try {
      await registerPushToken(userId, token, platform, deviceInfo);
      sendSuccess(res, { registered: true });
    } catch (err) {
      console.error('[push/register]', err);
      sendError(res, 'Erreur lors de l\'enregistrement du token', 500);
    }
  },
);

// DELETE /api/push/unregister — deactivate a specific push token
router.delete(
  '/unregister',
  authenticate,
  [body('token').notEmpty().withMessage('Token requis')],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body as { token: string };
    try {
      await deactivatePushToken(token);
      sendSuccess(res, { unregistered: true });
    } catch (err) {
      console.error('[push/unregister]', err);
      sendError(res, 'Erreur lors de la désinscription', 500);
    }
  },
);

export default router;
