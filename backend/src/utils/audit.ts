import { Request } from 'express';
import prisma from '../config/database';

type AuditAction =
  | 'LOGIN_SUCCESS' | 'LOGIN_FAIL' | 'MFA_SETUP' | 'MFA_VERIFY_SUCCESS'
  | 'MFA_VERIFY_FAIL' | 'PASSWORD_CHANGE' | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_SUCCESS' | 'DATA_ACCESS' | 'ADMIN_ACTION'
  | 'ACCOUNT_LOCKED' | 'TOKEN_REFRESH' | 'LOGOUT'
  | 'OTP_REQUEST' | 'OTP_VERIFY_SUCCESS' | 'OTP_VERIFY_FAIL'
  | 'REGISTER_SUCCESS' | 'ACCOUNT_DELETED';

interface AuditParams {
  userId?: string | null;
  action: AuditAction;
  resource?: string;
  success?: boolean;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export async function auditLog(params: AuditParams): Promise<void> {
  const { userId, action, resource, success = true, metadata, req } = params;

  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        resource,
        ipAddress: req ? getClientIp(req) : null,
        userAgent: req?.headers['user-agent']?.substring(0, 512) || null,
        success,
        metadata: (metadata as any) || undefined,
      },
    });
  } catch (err) {
    // Audit logging should never crash the app
    console.error('Audit log write failed:', err);
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}
