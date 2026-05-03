import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ==================== RS256 Key Management ====================

function loadOrGenerateKeys(): { privateKey: string; publicKey: string } {
  // Try environment variables first (production)
  if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
    return {
      privateKey: Buffer.from(process.env.JWT_PRIVATE_KEY, 'base64').toString('utf8'),
      publicKey: Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8'),
    };
  }

  // Dev: auto-generate and cache in keys/ directory
  const keysDir = path.join(__dirname, '../../keys');
  const privatePath = path.join(keysDir, 'private.pem');
  const publicPath = path.join(keysDir, 'public.pem');

  if (fs.existsSync(privatePath) && fs.existsSync(publicPath)) {
    return {
      privateKey: fs.readFileSync(privatePath, 'utf8'),
      publicKey: fs.readFileSync(publicPath, 'utf8'),
    };
  }

  console.log('🔑 Generating RS256 key pair for JWT...');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.mkdirSync(keysDir, { recursive: true });
  fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
  fs.writeFileSync(publicPath, publicKey, { mode: 0o644 });

  // Add keys/ to .gitignore
  const gitignorePath = path.join(__dirname, '../../.gitignore');
  const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  if (!gitignoreContent.includes('keys/')) {
    fs.appendFileSync(gitignorePath, '\nkeys/\n');
  }

  return { privateKey, publicKey };
}

const { privateKey: PRIVATE_KEY, publicKey: PUBLIC_KEY } = loadOrGenerateKeys();

// ==================== Token Durations ====================

const ACCESS_TOKEN_EXPIRY_ADMIN = '15m';
const ACCESS_TOKEN_EXPIRY_CLIENT = '2h';
const REFRESH_TOKEN_EXPIRY = '7d';
const PENDING_MFA_TOKEN_EXPIRY = '5m';

// ==================== Interfaces ====================

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  pv: number;       // passwordVersion
  sessionId: string;
  mfaVerified: boolean;
  deviceFingerprint?: string;
}

export interface PendingMfaPayload {
  userId: string;
  email: string;
  role: string;
  pv: number;
  mfaPending: true;
}

// ==================== Access Token (RS256) ====================

export const generateAccessToken = (payload: JWTPayload): string => {
  const expiresIn = payload.role === 'ADMIN' ? ACCESS_TOKEN_EXPIRY_ADMIN : ACCESS_TOKEN_EXPIRY_CLIENT;
  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn,
    issuer: 'salon-coiffure-api',
  } as SignOptions);
};

export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(token, PUBLIC_KEY, {
    algorithms: ['RS256'],
    issuer: 'salon-coiffure-api',
  }) as JWTPayload;
};

// ==================== Pending MFA Token ====================

export const generatePendingMfaToken = (payload: PendingMfaPayload): string => {
  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: PENDING_MFA_TOKEN_EXPIRY,
    issuer: 'salon-coiffure-api',
  } as SignOptions);
};

export const verifyPendingMfaToken = (token: string): PendingMfaPayload => {
  const decoded = jwt.verify(token, PUBLIC_KEY, {
    algorithms: ['RS256'],
    issuer: 'salon-coiffure-api',
  }) as PendingMfaPayload;
  if (!decoded.mfaPending) throw new Error('Not a pending MFA token');
  return decoded;
};

// ==================== Refresh Token ====================

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// ==================== Legacy HS256 (backward compat during migration) ====================

const LEGACY_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  return secret || 'dev_secret_change_in_production';
})();

export const verifyLegacyToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, LEGACY_SECRET, { algorithms: ['HS256'] }) as JWTPayload;
  } catch {
    return null;
  }
};

// ==================== OTP Token (5 min, used in registration flow) ====================

export interface OtpTokenPayload {
  email: string;
  purpose: 'registration';
  verified: true;
}

const OTP_TOKEN_EXPIRY = '5m';

export const generateOtpToken = (email: string): string => {
  const payload: OtpTokenPayload = { email, purpose: 'registration', verified: true };
  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: OTP_TOKEN_EXPIRY,
    issuer: 'salon-coiffure-api',
    audience: 'otp-completion',
  } as SignOptions);
};

export const verifyOtpToken = (token: string): OtpTokenPayload => {
  const decoded = jwt.verify(token, PUBLIC_KEY, {
    algorithms: ['RS256'],
    issuer: 'salon-coiffure-api',
    audience: 'otp-completion',
  }) as OtpTokenPayload;
  if (!decoded.verified || decoded.purpose !== 'registration') {
    throw new Error('Invalid OTP token');
  }
  return decoded;
};

// ==================== Public Key Export (for frontend middleware) ====================

export const getPublicKey = (): string => PUBLIC_KEY;
export const getRefreshTokenExpiry = (): number => 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// Type-only backward compat
export { generateAccessToken as generateToken, verifyAccessToken as verifyToken };

