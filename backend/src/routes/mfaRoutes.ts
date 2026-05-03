import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { rateLimitMfa } from '../middleware/rateLimit';
import {
  setupTotp,
  verifyTotpSetup,
  verifyTotp,
  webauthnRegisterOptions,
  webauthnRegisterVerify,
  webauthnAuthOptions,
  webauthnAuthVerify,
  sendEmailOtp,
  verifyEmailOtp,
  verifyBackupCode,
  disableMfa,
  getMfaStatus,
} from '../controllers/mfaController';

const router = Router();

// ==================== Status (authenticated) ====================
router.get('/status', authenticate, getMfaStatus);

// ==================== TOTP Setup (authenticated) ====================
router.post('/totp/setup', authenticate, setupTotp);
router.post('/totp/verify-setup', authenticate, verifyTotpSetup);

// ==================== TOTP Verify (login step-up, rate limited) ====================
router.post('/totp/verify', rateLimitMfa(), verifyTotp);

// ==================== WebAuthn Setup (authenticated) ====================
router.post('/webauthn/register-options', authenticate, webauthnRegisterOptions);
router.post('/webauthn/register-verify', authenticate, webauthnRegisterVerify);

// ==================== WebAuthn Auth (login step-up, rate limited) ====================
router.post('/webauthn/auth-options', rateLimitMfa(), webauthnAuthOptions);
router.post('/webauthn/auth-verify', rateLimitMfa(), webauthnAuthVerify);

// ==================== Email OTP (login step-up) ====================
router.post('/email/send', rateLimitMfa(), sendEmailOtp);
router.post('/email/verify', rateLimitMfa(), verifyEmailOtp);

// ==================== Backup Codes (login step-up) ====================
router.post('/backup/verify', rateLimitMfa(), verifyBackupCode);

// ==================== Disable MFA (authenticated) ====================
router.post('/disable', authenticate, disableMfa);

export default router;
