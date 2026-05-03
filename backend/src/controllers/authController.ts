import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';
import argon2 from 'argon2';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import {
  generateAccessToken,
  generatePendingMfaToken,
  generateRefreshToken,
  generateOtpToken,
  verifyOtpToken,
  hashToken,
  getRefreshTokenExpiry,
  JWTPayload,
} from '../utils/jwt';
import { redisSet, redisDel, redisGet } from '../config/redis';
import { auditLog } from '../utils/audit';
import { sendSuccess, sendError } from '../utils/responses';
import { sendOtpCode, sendWelcome } from '../services/emailService';

// ==================== Argon2id Config (OWASP) ====================

const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verify password — supports Argon2id (new) and bcrypt (legacy migration).
 * Returns true if valid. If bcrypt, triggers re-hash to Argon2id.
 */
async function verifyPassword(password: string, hash: string, userId?: string): Promise<boolean> {
  if (hash.startsWith('$argon2')) {
    return argon2.verify(hash, password);
  }
  // Legacy bcrypt hash — verify then migrate
  const valid = await bcrypt.compare(password, hash);
  if (valid && userId) {
    // Migrate to Argon2id in background
    const newHash = await hashPassword(password);
    await prisma.user.update({ where: { id: userId }, data: { password: newHash } }).catch(() => {});
  }
  return valid;
}

// ==================== Session & Token Helpers ====================

function generateSessionId(): string {
  return crypto.randomUUID();
}

function getDeviceFingerprint(req: Request): string {
  const ua = req.headers['user-agent'] || '';
  const ip = req.ip || '';
  return crypto.createHash('sha256').update(`${ua}:${ip}`).digest('hex').slice(0, 16);
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
    maxAge: 2 * 60 * 60 * 1000, // 2h (max for client role)
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/api/auth/refresh',
    maxAge: getRefreshTokenExpiry(),
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
}

async function createSession(userId: string, role: string, fingerprint: string, sessionId: string): Promise<void> {
  const ttl = role === 'ADMIN' ? 15 * 60 : 2 * 60 * 60; // 15min admin, 2h client
  await redisSet(
    `session:${sessionId}`,
    JSON.stringify({ userId, role, fingerprint, createdAt: Date.now() }),
    ttl
  );
}

async function storeRefreshToken(userId: string, refreshToken: string, req: Request): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + getRefreshTokenExpiry());

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      deviceInfo: {
        userAgent: req.headers['user-agent']?.substring(0, 256) || null,
        ip: req.ip || null,
      },
    },
  });
}

// ==================== POST /api/auth/register/cliente ====================

export const registerCliente = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, nom, prenom, telephone, dateNaissance } = req.body;

    // Validate password strength
    if (!password || password.length < 12) {
      sendError(res, 'Le mot de passe doit comporter au moins 12 caractères', 400);
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      sendError(res, 'Impossible de créer ce compte avec ces informations', 422);
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'CLIENTE',
        cliente: {
          create: {
            nom,
            prenom,
            telephone,
            dateNaissance: dateNaissance ? new Date(dateNaissance) : undefined,
          },
        },
      },
      include: { cliente: true },
    });

    // Create session
    const sessionId = generateSessionId();
    const fingerprint = getDeviceFingerprint(req);
    await createSession(user.id, user.role, fingerprint, sessionId);

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      pv: user.passwordVersion,
      sessionId,
      mfaVerified: true, // No MFA on registration
      deviceFingerprint: fingerprint,
    });

    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken, req);

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    // Audit
    await auditLog({ userId: user.id, action: 'LOGIN_SUCCESS', resource: 'register', req });

    sendSuccess(res, {
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        nom: user.cliente!.nom,
        prenom: user.cliente!.prenom,
        mustChangePassword: user.mustChangePassword,
        isMfaEnabled: false,
      },
    }, 201);
  } catch (error) {
    console.error('Erreur inscription:', error);
    sendError(res, 'Erreur lors de l\'inscription', 500);
  }
};

// ==================== POST /api/auth/login ====================

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { admin: true, coiffeuse: true, cliente: true },
    });

    if (!user || !user.actif) {
      await auditLog({ action: 'LOGIN_FAIL', resource: email, req, success: false });
      sendError(res, 'Email ou mot de passe incorrect', 401);
      return;
    }

    // Plan ADR-002: block login if email not verified (new OTP registration flow)
    if (!user.emailVerified) {
      await auditLog({ userId: user.id, action: 'LOGIN_FAIL', resource: 'email_not_verified', req, success: false });
      sendError(res, 'Votre adresse email n\'est pas vérifiée. Veuillez vous inscrire via le formulaire d\'inscription.', 403);
      return;
    }

    const validPassword = await verifyPassword(password, user.password, user.id);
    if (!validPassword) {
      await auditLog({ userId: user.id, action: 'LOGIN_FAIL', req, success: false });
      sendError(res, 'Email ou mot de passe incorrect', 401);
      return;
    }

    const profile = user.admin || user.coiffeuse || user.cliente;
    const fingerprint = getDeviceFingerprint(req);

    // ➤ If MFA is enabled → return pending token, require MFA step
    if (user.isMfaEnabled) {
      const pendingToken = generatePendingMfaToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        pv: user.passwordVersion,
        mfaPending: true,
      });

      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('mfa_pending', pendingToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'strict' : 'lax',
        path: '/',
        maxAge: 5 * 60 * 1000, // 5 min
      });

      await auditLog({ userId: user.id, action: 'LOGIN_SUCCESS', resource: 'mfa_pending', req });

      sendSuccess(res, {
        mfaRequired: true,
        mfaMethod: user.mfaMethod,
        pendingToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          nom: (profile as any)?.nom,
          prenom: (profile as any)?.prenom,
        },
      });
      return;
    }

    // ➤ Admin without MFA configured → issue token with mfaVerified=false so
    //   requireMfa blocks all admin routes. The admin can still reach MFA setup
    //   endpoints (they don't require requireMfa) to configure 2FA first.
    //   Once MFA is enabled and verified, all routes become accessible.

    // ➤ No MFA → direct login
    const sessionId = generateSessionId();
    await createSession(user.id, user.role, fingerprint, sessionId);

    // For ADMIN: even without MFA enabled, mfaVerified stays false so requireMfa
    // middleware continues to block admin API routes until MFA is configured & verified.
    const mfaVerifiedValue = user.role === 'ADMIN' ? false : !user.isMfaEnabled;

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      pv: user.passwordVersion,
      sessionId,
      mfaVerified: mfaVerifiedValue,
      deviceFingerprint: fingerprint,
    });

    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken, req);

    setAuthCookies(res, accessToken, refreshToken);

    await auditLog({ userId: user.id, action: 'LOGIN_SUCCESS', req });

    // Push notification — nouvelle connexion (non-blocking, plan section 6.3)
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || 'unknown';
    const loginDate = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    import('../services/pushService').then(({ notifySecurityEvent }) => {
      notifySecurityEvent(
        user.id,
        'new_login',
        `Nouvelle connexion depuis ${ip} le ${loginDate}`,
      ).catch(() => {});
    }).catch(() => {});

    sendSuccess(res, {
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        nom: (profile as any)?.nom,
        prenom: (profile as any)?.prenom,
        mustChangePassword: user.mustChangePassword,
        isMfaEnabled: user.isMfaEnabled,
        mfaMethod: user.mfaMethod,
      },
    });
  } catch (error) {
    console.error('Erreur connexion:', error);
    sendError(res, 'Erreur lors de la connexion', 500);
  }
};

// ==================== POST /api/auth/refresh ====================

export const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshTokenValue = req.cookies?.refresh_token || req.body?.refreshToken;

    if (!refreshTokenValue) {
      sendError(res, 'Refresh token manquant', 401);
      return;
    }

    const tokenHash = hashToken(refreshTokenValue);

    // Find the refresh token in DB
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { admin: true, coiffeuse: true, cliente: true } } },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      if (storedToken && !storedToken.revokedAt) {
        // Token reuse detected — revoke all tokens for this user (potential theft)
        await prisma.refreshToken.updateMany({
          where: { userId: storedToken.userId },
          data: { revokedAt: new Date() },
        });
        await auditLog({ userId: storedToken.userId, action: 'ACCOUNT_LOCKED', resource: 'token_reuse_detected', req, success: false });
      }
      clearAuthCookies(res);
      sendError(res, 'Token de rafraîchissement invalide', 401);
      return;
    }

    // Rotate: revoke old, create new
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const user = storedToken.user;
    const fingerprint = getDeviceFingerprint(req);
    const sessionId = generateSessionId();
    await createSession(user.id, user.role, fingerprint, sessionId);

    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      pv: user.passwordVersion,
      sessionId,
      mfaVerified: true, // If they had a valid refresh token, MFA was already done
      deviceFingerprint: fingerprint,
    });

    const newRefreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, newRefreshToken, req);

    setAuthCookies(res, newAccessToken, newRefreshToken);

    await auditLog({ userId: user.id, action: 'TOKEN_REFRESH', req });

    const profile = user.admin || user.coiffeuse || user.cliente;
    sendSuccess(res, {
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        nom: (profile as any)?.nom,
        prenom: (profile as any)?.prenom,
        isMfaEnabled: user.isMfaEnabled,
      },
    });
  } catch (error) {
    console.error('Erreur refresh:', error);
    sendError(res, 'Erreur lors du rafraîchissement', 500);
  }
};

// ==================== POST /api/auth/logout ====================

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    // Revoke refresh token
    const refreshTokenValue = req.cookies?.refresh_token;
    if (refreshTokenValue) {
      const tokenHash = hashToken(refreshTokenValue);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    // Destroy Redis session
    if (req.user?.sessionId) {
      await redisDel(`session:${req.user.sessionId}`);
    }

    clearAuthCookies(res);

    if (userId) {
      await auditLog({ userId, action: 'LOGOUT', req });
    }

    sendSuccess(res, { loggedOut: true });
  } catch (error) {
    clearAuthCookies(res);
    sendSuccess(res, { loggedOut: true });
  }
};

// ==================== GET /api/auth/me ====================

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { admin: true, coiffeuse: { include: { disponibilites: true } }, cliente: true },
    });

    if (!user) {
      sendError(res, 'Utilisateur non trouvé', 404);
      return;
    }

    const { password, encryptedTotpSecret, ...userData } = user;
    sendSuccess(res, userData);
  } catch (error) {
    sendError(res, 'Erreur serveur', 500);
  }
};

// ==================== PUT /api/auth/profil ====================

export const updateProfil = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.user!;
    const { nom, prenom, telephone, email, bio, specialites, niveau, motDePasseActuel } = req.body;

    if (role === 'CLIENTE') {
      const data: Record<string, unknown> = {};
      if (nom !== undefined) data.nom = nom;
      if (prenom !== undefined) data.prenom = prenom;
      if (telephone !== undefined) data.telephone = telephone;
      if (Object.keys(data).length > 0) await prisma.cliente.update({ where: { userId }, data });
    } else if (role === 'COIFFEUSE') {
      const data: Record<string, unknown> = {};
      if (nom !== undefined) data.nom = nom;
      if (prenom !== undefined) data.prenom = prenom;
      if (bio !== undefined) data.bio = bio;
      if (specialites !== undefined) data.specialites = specialites;
      if (niveau !== undefined) data.niveau = niveau;
      if (Object.keys(data).length > 0) await prisma.coiffeuse.update({ where: { userId }, data });
    } else if (role === 'ADMIN') {
      const data: Record<string, unknown> = {};
      if (nom !== undefined) data.nom = nom;
      if (prenom !== undefined) data.prenom = prenom;
      if (telephone !== undefined) data.telephone = telephone;
      if (Object.keys(data).length > 0) await prisma.admin.update({ where: { userId }, data });
    }

    if (email !== undefined && email !== '') {
      // Email change requires password confirmation
      if (!motDePasseActuel) {
        sendError(res, 'Mot de passe requis pour modifier l\'email', 400);
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) { sendError(res, 'Utilisateur non trouvé', 404); return; }
      const valid = await verifyPassword(motDePasseActuel, user.password, userId);
      if (!valid) { sendError(res, 'Mot de passe incorrect', 403); return; }

      const existing = await prisma.user.findFirst({ where: { email, id: { not: userId } } });
      if (existing) { sendError(res, 'Cet email est déjà utilisé', 409); return; }
      await prisma.user.update({ where: { id: userId }, data: { email } });
    }

    sendSuccess(res, { updated: true });
  } catch (error) {
    sendError(res, 'Erreur mise à jour profil', 500);
  }
};

// ==================== PUT /api/auth/password ====================

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.user!;
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;

    if (!nouveauMotDePasse || nouveauMotDePasse.length < 12) {
      sendError(res, 'Le nouveau mot de passe doit comporter au moins 12 caractères', 400);
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { sendError(res, 'Utilisateur non trouvé', 404); return; }

    const valid = await verifyPassword(ancienMotDePasse, user.password);
    if (!valid) { sendError(res, 'Ancien mot de passe incorrect', 400); return; }

    const hashed = await hashPassword(nouveauMotDePasse);

    // Update password, increment version, revoke all refresh tokens
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          password: hashed,
          passwordVersion: { increment: 1 },
          mustChangePassword: false,
        },
      }),
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await auditLog({ userId, action: 'PASSWORD_CHANGE', req });

    // Push notification — sécurité (non-blocking, plan section 6.3)
    import('../services/pushService').then(({ notifySecurityEvent }) => {
      notifySecurityEvent(
        userId,
        'password_changed',
        'Votre mot de passe a été modifié. Si ce n\'est pas vous, contactez-nous immédiatement.',
      ).catch(() => {});
    }).catch(() => {});

    sendSuccess(res, { updated: true });
  } catch (error) {
    sendError(res, 'Erreur changement mot de passe', 500);
  }
};

// ==================== OTP Registration Flow ====================

const OTP_TTL = parseInt(process.env.OTP_TTL_SECONDS || '600', 10); // 10 min
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10);

/** Derive a consistent Redis key for OTP data given a plaintext email. */
function otpRedisKey(email: string): string {
  const hash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32);
  return `otp:${hash}`;
}

// ==================== POST /api/auth/request-otp ====================

export const requestOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email: string };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendError(res, 'Adresse email invalide', 400);
      return;
    }

    // Security: if account already exists, still return success to prevent enumeration
    // but send a security-alert email instead of OTP
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Fire-and-forget; don't leak timing differences
      import('../services/emailService').then(({ sendSecurityAlert }) => {
        sendSecurityAlert(email, 'duplicate_registration_attempt').catch(() => {});
      }).catch(() => {});
      // Return same response shape as success — anti-enumeration
      sendSuccess(res, { sent: true });
      return;
    }

    // Generate 6-digit OTP using cryptographically secure random
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(code, 10);

    const key = otpRedisKey(email);
    await redisSet(
      key,
      JSON.stringify({ codeHash, attempts: 0, email }),
      OTP_TTL,
    );

    await sendOtpCode(email, code, Math.round(OTP_TTL / 60));

    await auditLog({ action: 'OTP_REQUEST', resource: email, req });

    sendSuccess(res, { sent: true });
  } catch (error) {
    console.error('Erreur request-otp:', error);
    sendError(res, 'Erreur lors de l\'envoi du code', 500);
  }
};

// ==================== POST /api/auth/verify-otp ====================

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code } = req.body as { email: string; code: string };

    if (!email || !code || !/^\d{6}$/.test(code)) {
      sendError(res, 'Email ou code invalide', 400);
      return;
    }

    const key = otpRedisKey(email);
    const raw = await redisGet(key);

    if (!raw) {
      sendError(res, 'Code expiré ou invalide. Veuillez en demander un nouveau.', 400);
      return;
    }

    let stored: { codeHash: string; attempts: number; email: string };
    try {
      stored = JSON.parse(raw);
    } catch {
      sendError(res, 'Code expiré ou invalide.', 400);
      return;
    }

    if (stored.attempts >= OTP_MAX_ATTEMPTS) {
      await redisDel(key);
      await auditLog({ action: 'OTP_VERIFY_FAIL', resource: email, req, success: false });
      sendError(res, 'Trop de tentatives. Veuillez demander un nouveau code.', 429);
      return;
    }

    const valid = await bcrypt.compare(code, stored.codeHash);

    if (!valid) {
      stored.attempts += 1;
      // Update attempts counter keeping same TTL (approximate, use set with remaining TTL)
      await redisSet(key, JSON.stringify(stored), OTP_TTL);
      await auditLog({ action: 'OTP_VERIFY_FAIL', resource: email, req, success: false });
      const remaining = OTP_MAX_ATTEMPTS - stored.attempts;
      sendError(
        res,
        remaining > 0
          ? `Code incorrect. ${remaining} tentative(s) restante(s).`
          : 'Code incorrect. Veuillez demander un nouveau code.',
        400,
      );
      return;
    }

    // Valid — delete OTP from Redis and issue short-lived token
    await redisDel(key);
    await auditLog({ action: 'OTP_VERIFY_SUCCESS', resource: email, req });

    const otpToken = generateOtpToken(email);

    sendSuccess(res, { verified: true, otpToken });
  } catch (error) {
    console.error('Erreur verify-otp:', error);
    sendError(res, 'Erreur lors de la vérification du code', 500);
  }
};

// ==================== POST /api/auth/complete-registration ====================

export const completeRegistration = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      sendError(res, 'Token OTP manquant', 401);
      return;
    }

    let otpPayload;
    try {
      otpPayload = verifyOtpToken(authHeader.slice(7));
    } catch {
      sendError(res, 'Token OTP invalide ou expiré', 401);
      return;
    }

    const { email } = otpPayload;
    const { password, nom, prenom, telephone, dateNaissance } = req.body as {
      password: string;
      nom: string;
      prenom: string;
      telephone?: string;
      dateNaissance?: string;
    };

    if (!password || password.length < 12) {
      sendError(res, 'Le mot de passe doit comporter au moins 12 caractères', 400);
      return;
    }

    if (!nom?.trim() || !prenom?.trim()) {
      sendError(res, 'Nom et prénom sont requis', 400);
      return;
    }

    // Re-check email availability (race condition guard)
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      sendError(res, 'Impossible de créer ce compte avec ces informations', 422);
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'CLIENTE',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        cliente: {
          create: {
            nom: nom.trim(),
            prenom: prenom.trim(),
            telephone: telephone?.trim() || '',
            dateNaissance: dateNaissance ? new Date(dateNaissance) : undefined,
          },
        },
      },
      include: { cliente: true },
    });

    // Send welcome email (non-blocking)
    sendWelcome(email, prenom.trim()).catch(() => {});

    // Create session
    const sessionId = generateSessionId();
    const fingerprint = getDeviceFingerprint(req);
    await createSession(user.id, user.role, fingerprint, sessionId);

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      pv: user.passwordVersion,
      sessionId,
      mfaVerified: true,
      deviceFingerprint: fingerprint,
    });

    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken, req);

    setAuthCookies(res, accessToken, refreshToken);

    await auditLog({ userId: user.id, action: 'REGISTER_SUCCESS', resource: 'complete-registration', req });

    sendSuccess(res, {
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        nom: user.cliente!.nom,
        prenom: user.cliente!.prenom,
        mustChangePassword: user.mustChangePassword,
        isMfaEnabled: false,
      },
    }, 201);
  } catch (error) {
    console.error('Erreur complete-registration:', error);
    sendError(res, 'Erreur lors de l\'inscription', 500);
  }
};

