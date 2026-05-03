import { Router } from 'express';
import { body, query } from 'express-validator';
import {
  registerCliente,
  login,
  getMe,
  updateProfil,
  changePassword,
  refreshAccessToken,
  logout,
  requestOtp,
  verifyOtp,
  completeRegistration,
} from '../controllers/authController';
import { forgotPassword, verifyResetToken, resetPassword } from '../controllers/passwordResetController';
import { authenticate } from '../middleware/auth';
import { rateLimitLogin, rateLimitPasswordReset, rateLimitOtp } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 12 }).withMessage('Mot de passe : 12 caractères minimum'),
    body('nom').trim().notEmpty().withMessage('Nom requis'),
    body('prenom').trim().notEmpty().withMessage('Prénom requis'),
    body('telephone').trim().notEmpty().withMessage('Téléphone requis'),
  ],
  validate,
  registerCliente
);

router.post(
  '/login',
  rateLimitLogin(),
  [
    body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
    body('password').notEmpty().withMessage('Mot de passe requis'),
  ],
  validate,
  login
);

// Refresh token (rotation)
router.post('/refresh', refreshAccessToken);

// Logout (revoke tokens + session)
router.post('/logout', authenticate, logout);

// Password recovery
router.post(
  '/forgot-password',
  rateLimitPasswordReset(),
  [body('email').isEmail().normalizeEmail().withMessage('Email invalide')],
  validate,
  forgotPassword
);

router.get(
  '/verify-reset-token',
  [
    query('token').notEmpty().withMessage('Token requis'),
    query('uid').isUUID().withMessage('UID invalide'),
  ],
  validate,
  verifyResetToken
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token requis'),
    body('uid').isUUID().withMessage('UID invalide'),
    body('newPassword').isLength({ min: 12 }).withMessage('Mot de passe : 12 caractères minimum'),
  ],
  validate,
  resetPassword
);

// Authenticated routes
router.get('/me', authenticate, getMe);
router.put('/profil', authenticate, updateProfil);
router.put('/password', authenticate, changePassword);

// ==================== OTP Registration Flow ====================

router.post(
  '/request-otp',
  rateLimitOtp(),
  [body('email').isEmail().normalizeEmail().withMessage('Email invalide')],
  validate,
  requestOtp,
);

router.post(
  '/verify-otp',
  [
    body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
    body('code').matches(/^\d{6}$/).withMessage('Code à 6 chiffres requis'),
  ],
  validate,
  verifyOtp,
);

router.post(
  '/complete-registration',
  [
    body('password').isLength({ min: 12 }).withMessage('Mot de passe : 12 caractères minimum'),
    body('nom').trim().notEmpty().withMessage('Nom requis'),
    body('prenom').trim().notEmpty().withMessage('Prénom requis'),
    body('telephone').optional().trim(),
    body('dateNaissance').optional().isISO8601().withMessage('Date de naissance invalide'),
  ],
  validate,
  completeRegistration,
);

export default router;
