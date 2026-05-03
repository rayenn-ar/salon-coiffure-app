/**
 * Resend webhook endpoint — receives delivery status events for outbound emails.
 * Mounted at POST /api/webhooks/email-events
 *
 * Security: Resend signs every webhook request with an HMAC-SHA256 signature
 * in the `svix-signature` header. We verify it using EMAIL_WEBHOOK_SECRET.
 * The route must be mounted BEFORE the bodyParser middleware that converts the
 * raw stream to an object — we need the raw body for signature verification.
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { sendError, sendSuccess } from '../utils/responses';

const router = Router();

// ==================== Signature Verification ====================

function verifyResendSignature(req: Request): boolean {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret) {
    // Not configured — skip verification in dev
    if (process.env.NODE_ENV !== 'production') return true;
    return false;
  }

  const svixId = req.headers['svix-id'] as string | undefined;
  const svixTimestamp = req.headers['svix-timestamp'] as string | undefined;
  const svixSignature = req.headers['svix-signature'] as string | undefined;

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Reject requests older than 5 minutes (replay attack prevention)
  const tsMs = parseInt(svixTimestamp, 10) * 1000;
  if (Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) return false;

  // Signed payload = {msgId}.{timestamp}.{body}
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) return false;
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody.toString('utf8')}`;

  // Secret is prefixed with "whsec_" and then base64 encoded
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expectedSig = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  // svix-signature may contain multiple "v1,<sig>" entries separated by spaces
  const signatures = svixSignature.split(' ').map((s) => s.replace(/^v\d+,/, ''));
  return signatures.some(
    (sig) => crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig)),
  );
}

// ==================== POST /api/webhooks/email-events ====================

router.post(
  '/email-events',
  async (req: Request, res: Response): Promise<void> => {
    if (!verifyResendSignature(req)) {
      sendError(res, 'Signature invalide', 401);
      return;
    }

    const event = req.body as {
      type: string;
      data?: {
        email_id?: string;
        to?: string[];
        subject?: string;
        created_at?: string;
      };
    };

    const { type, data } = event;
    const providerId = data?.email_id;

    try {
      switch (type) {
        case 'email.delivered':
          if (providerId) {
            await prisma.emailLog.updateMany({
              where: { providerId },
              data: { status: 'delivered', deliveredAt: new Date() },
            });
          }
          break;

        case 'email.bounced':
          if (providerId) {
            await prisma.emailLog.updateMany({
              where: { providerId },
              data: { status: 'bounced', bouncedAt: new Date() },
            });
          }
          break;

        case 'email.spam_complaint':
          if (providerId) {
            await prisma.emailLog.updateMany({
              where: { providerId },
              data: { status: 'spam_complaint' },
            });
          }
          break;

        default:
          // Unhandled event type — log and move on
          console.log(`[webhooks/email-events] Unhandled event type: ${type}`);
      }

      sendSuccess(res, { processed: true });
    } catch (err) {
      console.error('[webhooks/email-events]', err);
      sendError(res, 'Erreur traitement webhook', 500);
    }
  },
);

export default router;
