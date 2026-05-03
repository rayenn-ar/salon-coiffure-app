import { Request, Response } from 'express';
import crypto from 'crypto';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import prisma from '../config/database';
import { encrypt, decrypt } from '../config/encryption';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyPendingMfaToken,
  getRefreshTokenExpiry,
} from '../utils/jwt';
import { redisSet, redisGet, redisDel } from '../config/redis';
import { auditLog } from '../utils/audit';
import { sendSuccess, sendError } from '../utils/responses';

// ==================== Config ====================

const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'Salon de Coiffure';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

// ==================== Helpers ====================

function getDeviceFingerprint(req: Request): string {
  const ua = req.headers['user-agent'] || '';
  const ip = req.ip || '';
  return crypto.createHash('sha256').update(`${ua}:${ip}`).digest('hex').slice(0, 16);
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('access_token', accessToken, {
    httpOnly: true, secure: isProd, sameSite: isProd ? 'strict' : 'lax', path: '/', maxAge: 2 * 60 * 60 * 1000,
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true, secure: isProd, sameSite: isProd ? 'strict' : 'lax', path: '/api/auth/refresh', maxAge: getRefreshTokenExpiry(),
  });
}

async function completeMfaLogin(userId: string, req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { admin: true, coiffeuse: true, cliente: true },
  });
  if (!user) { sendError(res, 'Utilisateur non trouvé', 404); return; }

  const fingerprint = getDeviceFingerprint(req);
  const sessionId = crypto.randomUUID();

  // Create session
  const ttl = user.role === 'ADMIN' ? 15 * 60 : 2 * 60 * 60;
  await redisSet(`session:${sessionId}`, JSON.stringify({ userId, role: user.role, fingerprint }), ttl);

  const accessToken = generateAccessToken({
    userId: user.id, email: user.email, role: user.role,
    pv: user.passwordVersion, sessionId, mfaVerified: true,
    deviceFingerprint: fingerprint,
  });

  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId, tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + getRefreshTokenExpiry()),
      deviceInfo: { userAgent: req.headers['user-agent']?.substring(0, 256), ip: req.ip },
    },
  });

  setAuthCookies(res, accessToken, refreshToken);
  res.clearCookie('mfa_pending', { path: '/' });

  const profile = user.admin || user.coiffeuse || user.cliente;

  await auditLog({ userId, action: 'MFA_VERIFY_SUCCESS', req });

  sendSuccess(res, {
    token: accessToken,
    refreshToken,
    user: {
      id: user.id, email: user.email, role: user.role,
      nom: (profile as any)?.nom, prenom: (profile as any)?.prenom,
      isMfaEnabled: true, mfaMethod: user.mfaMethod,
    },
  });
}

// ==================== TOTP Setup ====================

// POST /api/mfa/totp/setup
export const setupTotp = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.user;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { sendError(res, 'Utilisateur non trouvé', 404); return; }

    // Generate TOTP secret
    const secret = new OTPAuth.Secret({ size: 32 });
    const totp = new OTPAuth.TOTP({
      issuer: RP_NAME,
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const otpauthUrl = totp.toString();

    // Store encrypted secret temporarily in Redis (not saved until verified)
    await redisSet(`totp_setup:${userId}`, encrypt(secret.base32), 600); // 10 min

    // Generate QR code data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    sendSuccess(res, {
      secret: secret.base32,
      qrCode: qrCodeDataUrl,
      otpauthUrl,
    });
  } catch (error) {
    console.error('TOTP setup error:', error);
    sendError(res, 'Erreur lors de la configuration TOTP', 500);
  }
};

// POST /api/mfa/totp/verify-setup
export const verifyTotpSetup = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.user;
    const { code } = req.body;

    if (!code || !/^\d{6}$/.test(code)) {
      sendError(res, 'Code TOTP invalide (6 chiffres requis)', 400);
      return;
    }

    // Get pending secret from Redis
    const encryptedSecret = await redisGet(`totp_setup:${userId}`);
    if (!encryptedSecret) {
      sendError(res, 'Configuration TOTP expirée. Veuillez recommencer.', 400);
      return;
    }

    const secretBase32 = decrypt(encryptedSecret);
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secretBase32),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    // Verify with ±1 window for clock skew
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      await auditLog({ userId, action: 'MFA_VERIFY_FAIL', resource: 'totp_setup', req, success: false });
      sendError(res, 'Code TOTP incorrect', 400);
      return;
    }

    // Save encrypted secret to DB
    await prisma.user.update({
      where: { id: userId },
      data: {
        encryptedTotpSecret: encrypt(secretBase32),
        isMfaEnabled: true,
        mfaMethod: 'totp',
      },
    });

    // Generate backup codes
    const backupCodes = await generateBackupCodes(userId);

    // Cleanup
    await redisDel(`totp_setup:${userId}`);
    await auditLog({ userId, action: 'MFA_SETUP', resource: 'totp', req });

    sendSuccess(res, {
      enabled: true,
      method: 'totp',
      backupCodes, // Show once, never again
    });
  } catch (error) {
    console.error('TOTP verify-setup error:', error);
    sendError(res, 'Erreur lors de la vérification TOTP', 500);
  }
};

// ==================== TOTP Verify (Login Step-up) ====================

// POST /api/mfa/totp/verify
export const verifyTotp = async (req: Request, res: Response): Promise<void> => {
  try {
    const pendingToken = req.cookies?.mfa_pending || req.body?.pendingToken;
    if (!pendingToken) { sendError(res, 'Token MFA pending manquant', 401); return; }

    const pending = verifyPendingMfaToken(pendingToken);
    const { code } = req.body;

    if (!code || !/^\d{6}$/.test(code)) {
      sendError(res, 'Code TOTP invalide', 400);
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: pending.userId } });
    if (!user?.encryptedTotpSecret) { sendError(res, 'TOTP non configuré', 400); return; }

    const secretBase32 = decrypt(user.encryptedTotpSecret);
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secretBase32),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      await auditLog({ userId: pending.userId, action: 'MFA_VERIFY_FAIL', resource: 'totp', req, success: false });
      sendError(res, 'Code TOTP incorrect', 401);
      return;
    }

    await completeMfaLogin(pending.userId, req, res);
  } catch (error) {
    console.error('TOTP verify error:', error);
    sendError(res, 'Erreur vérification TOTP', 500);
  }
};

// ==================== WebAuthn Registration ====================

// POST /api/mfa/webauthn/register-options
export const webauthnRegisterOptions = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.user;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { sendError(res, 'Utilisateur non trouvé', 404); return; }

    const existingCreds = await prisma.webauthnCredential.findMany({
      where: { userId },
      select: { credentialId: true, transports: true },
    });

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email,
      userDisplayName: user.email,
      attestationType: 'direct',
      authenticatorSelection: {
        userVerification: 'required',
        residentKey: 'preferred',
      },
      excludeCredentials: existingCreds.map((c) => ({
        id: c.credentialId,
        transports: c.transports as any[],
      })),
    });

    // Store challenge in Redis
    await redisSet(`webauthn_challenge:${userId}`, options.challenge, 300);

    sendSuccess(res, options);
  } catch (error) {
    console.error('WebAuthn register-options error:', error);
    sendError(res, 'Erreur WebAuthn', 500);
  }
};

// POST /api/mfa/webauthn/register-verify
export const webauthnRegisterVerify = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.user;
    const body: RegistrationResponseJSON = req.body;

    const expectedChallenge = await redisGet(`webauthn_challenge:${userId}`);
    if (!expectedChallenge) { sendError(res, 'Challenge expiré', 400); return; }

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      sendError(res, 'Vérification WebAuthn échouée', 400);
      return;
    }

    const { credential, credentialDeviceType } = verification.registrationInfo;

    await prisma.webauthnCredential.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        transports: body.response.transports || [],
      },
    });

    // Enable MFA if not already
    await prisma.user.update({
      where: { id: userId },
      data: { isMfaEnabled: true, mfaMethod: 'webauthn' },
    });

    // Generate backup codes if first MFA setup
    const existingBackupCodes = await prisma.backupCode.count({ where: { userId } });
    let backupCodes: string[] = [];
    if (existingBackupCodes === 0) {
      backupCodes = await generateBackupCodes(userId);
    }

    await redisDel(`webauthn_challenge:${userId}`);
    await auditLog({ userId, action: 'MFA_SETUP', resource: 'webauthn', req });

    sendSuccess(res, { enabled: true, method: 'webauthn', backupCodes });
  } catch (error) {
    console.error('WebAuthn register-verify error:', error);
    sendError(res, 'Erreur vérification WebAuthn', 500);
  }
};

// ==================== WebAuthn Authentication (Login Step-up) ====================

// POST /api/mfa/webauthn/auth-options
export const webauthnAuthOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const pendingToken = req.cookies?.mfa_pending || req.body?.pendingToken;
    if (!pendingToken) { sendError(res, 'Token MFA pending manquant', 401); return; }

    const pending = verifyPendingMfaToken(pendingToken);

    const creds = await prisma.webauthnCredential.findMany({
      where: { userId: pending.userId },
      select: { credentialId: true, transports: true },
    });

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'required',
      allowCredentials: creds.map((c) => ({
        id: c.credentialId,
        transports: c.transports as any[],
      })),
    });

    await redisSet(`webauthn_auth_challenge:${pending.userId}`, options.challenge, 300);

    sendSuccess(res, options);
  } catch (error) {
    console.error('WebAuthn auth-options error:', error);
    sendError(res, 'Erreur WebAuthn', 500);
  }
};

// POST /api/mfa/webauthn/auth-verify
export const webauthnAuthVerify = async (req: Request, res: Response): Promise<void> => {
  try {
    const pendingToken = req.cookies?.mfa_pending || req.body?.pendingToken;
    if (!pendingToken) { sendError(res, 'Token MFA pending manquant', 401); return; }

    const pending = verifyPendingMfaToken(pendingToken);
    const body: AuthenticationResponseJSON = req.body;

    const expectedChallenge = await redisGet(`webauthn_auth_challenge:${pending.userId}`);
    if (!expectedChallenge) { sendError(res, 'Challenge expiré', 400); return; }

    const credential = await prisma.webauthnCredential.findUnique({
      where: { credentialId: body.id },
    });

    if (!credential || credential.userId !== pending.userId) {
      sendError(res, 'Credential non trouvée', 400);
      return;
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: credential.credentialId,
        publicKey: credential.publicKey,
        counter: Number(credential.counter),
        transports: credential.transports as any[],
      },
    });

    if (!verification.verified) {
      await auditLog({ userId: pending.userId, action: 'MFA_VERIFY_FAIL', resource: 'webauthn', req, success: false });
      sendError(res, 'Vérification WebAuthn échouée', 401);
      return;
    }

    // Anti-cloning: verify counter increased
    const newCounter = verification.authenticationInfo.newCounter;
    if (newCounter <= Number(credential.counter)) {
      await auditLog({ userId: pending.userId, action: 'MFA_VERIFY_FAIL', resource: 'webauthn_cloning', req, success: false });
      sendError(res, 'Erreur de sécurité: compteur invalide', 401);
      return;
    }

    // Update counter
    await prisma.webauthnCredential.update({
      where: { id: credential.id },
      data: { counter: BigInt(newCounter) },
    });

    await redisDel(`webauthn_auth_challenge:${pending.userId}`);
    await completeMfaLogin(pending.userId, req, res);
  } catch (error) {
    console.error('WebAuthn auth-verify error:', error);
    sendError(res, 'Erreur vérification WebAuthn', 500);
  }
};

// ==================== Email OTP ====================

// POST /api/mfa/email/send
export const sendEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const pendingToken = req.cookies?.mfa_pending || req.body?.pendingToken;
    if (!pendingToken) { sendError(res, 'Token MFA pending manquant', 401); return; }

    const pending = verifyPendingMfaToken(pendingToken);

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // Store in Redis with 5 min TTL
    await redisSet(`2fa_email:${pending.userId}`, otpHash, 300);

    // TODO: Send email with OTP code
    // In production, integrate with email service (SendGrid, SES, etc.)
    console.log(`📧 [DEV] OTP for user ${pending.userId}: ${otp}`);

    sendSuccess(res, { sent: true, expiresIn: 300 });
  } catch (error) {
    console.error('Email OTP error:', error);
    sendError(res, 'Erreur envoi OTP', 500);
  }
};

// POST /api/mfa/email/verify
export const verifyEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const pendingToken = req.cookies?.mfa_pending || req.body?.pendingToken;
    if (!pendingToken) { sendError(res, 'Token MFA pending manquant', 401); return; }

    const pending = verifyPendingMfaToken(pendingToken);
    const { code } = req.body;

    if (!code || !/^\d{6}$/.test(code)) {
      sendError(res, 'Code OTP invalide (6 chiffres requis)', 400);
      return;
    }

    const otpHash = await redisGet(`2fa_email:${pending.userId}`);
    if (!otpHash) {
      sendError(res, 'Code OTP expiré', 400);
      return;
    }

    const valid = await bcrypt.compare(code, otpHash);
    if (!valid) {
      await auditLog({ userId: pending.userId, action: 'MFA_VERIFY_FAIL', resource: 'email_otp', req, success: false });
      sendError(res, 'Code OTP incorrect', 401);
      return;
    }

    await redisDel(`2fa_email:${pending.userId}`);
    await completeMfaLogin(pending.userId, req, res);
  } catch (error) {
    console.error('Email OTP verify error:', error);
    sendError(res, 'Erreur vérification OTP', 500);
  }
};

// ==================== Backup Codes ====================

async function generateBackupCodes(userId: string): Promise<string[]> {
  // Delete existing codes
  await prisma.backupCode.deleteMany({ where: { userId } });

  const codes: string[] = [];
  const records = [];

  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 char hex code
    codes.push(code);
    const codeHash = await bcrypt.hash(code, 10);
    records.push({ userId, codeHash });
  }

  await prisma.backupCode.createMany({ data: records });
  return codes;
}

// POST /api/mfa/backup/verify
export const verifyBackupCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const pendingToken = req.cookies?.mfa_pending || req.body?.pendingToken;
    if (!pendingToken) { sendError(res, 'Token MFA pending manquant', 401); return; }

    const pending = verifyPendingMfaToken(pendingToken);
    const { code } = req.body;

    if (!code) { sendError(res, 'Code de secours requis', 400); return; }

    const backupCodes = await prisma.backupCode.findMany({
      where: { userId: pending.userId, usedAt: null },
    });

    let verified = false;
    let matchedId = '';

    for (const bc of backupCodes) {
      const valid = await bcrypt.compare(code.toUpperCase(), bc.codeHash);
      if (valid) {
        verified = true;
        matchedId = bc.id;
        break;
      }
    }

    if (!verified) {
      await auditLog({ userId: pending.userId, action: 'MFA_VERIFY_FAIL', resource: 'backup_code', req, success: false });
      sendError(res, 'Code de secours invalide', 401);
      return;
    }

    // Mark as used (one-time)
    await prisma.backupCode.update({
      where: { id: matchedId },
      data: { usedAt: new Date() },
    });

    await completeMfaLogin(pending.userId, req, res);
  } catch (error) {
    console.error('Backup code verify error:', error);
    sendError(res, 'Erreur vérification code de secours', 500);
  }
};

// ==================== Disable MFA ====================

// POST /api/mfa/disable
export const disableMfa = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.user;
    const { password } = req.body;

    // Require password confirmation
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { sendError(res, 'Utilisateur non trouvé', 404); return; }

    // Admin cannot disable MFA (policy)
    if (user.role === 'ADMIN') {
      sendError(res, 'Les administrateurs ne peuvent pas désactiver le MFA', 403);
      return;
    }

    if (!password) { sendError(res, 'Mot de passe requis', 400); return; }

    const argon2 = await import('argon2');
    let valid: boolean;
    if (user.password.startsWith('$argon2')) {
      valid = await argon2.verify(user.password, password);
    } else {
      valid = await bcrypt.compare(password, user.password);
    }
    if (!valid) { sendError(res, 'Mot de passe incorrect', 401); return; }

    // Cleanup
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isMfaEnabled: false, mfaMethod: null, encryptedTotpSecret: null },
      }),
      prisma.webauthnCredential.deleteMany({ where: { userId } }),
      prisma.backupCode.deleteMany({ where: { userId } }),
    ]);

    await auditLog({ userId, action: 'MFA_SETUP', resource: 'disabled', req });

    sendSuccess(res, { disabled: true });
  } catch (error) {
    console.error('Disable MFA error:', error);
    sendError(res, 'Erreur désactivation MFA', 500);
  }
};

// ==================== MFA Status ====================

// GET /api/mfa/status
export const getMfaStatus = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.user;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isMfaEnabled: true, mfaMethod: true },
    });

    const webauthnCount = await prisma.webauthnCredential.count({ where: { userId } });
    const backupCodesRemaining = await prisma.backupCode.count({ where: { userId, usedAt: null } });

    sendSuccess(res, {
      enabled: user?.isMfaEnabled || false,
      method: user?.mfaMethod,
      webauthnDevices: webauthnCount,
      backupCodesRemaining,
    });
  } catch (error) {
    sendError(res, 'Erreur statut MFA', 500);
  }
};
