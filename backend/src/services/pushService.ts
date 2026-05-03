import prisma from '../config/database';

// ==================== Firebase Lazy Initialization ====================
// Firebase Admin SDK is optional in development — if credentials are missing,
// all push operations silently succeed (no-op) so the rest of the app works normally.

let messagingInstance: import('firebase-admin/messaging').Messaging | null = null;

async function getMessaging(): Promise<import('firebase-admin/messaging').Messaging | null> {
  if (messagingInstance) return messagingInstance;

  const { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
    return null; // Firebase not configured — graceful no-op
  }

  try {
    const admin = await import('firebase-admin');
    const app =
      admin.apps.length > 0
        ? admin.app()
        : admin.initializeApp({
            credential: admin.credential.cert({
              projectId: FIREBASE_PROJECT_ID,
              privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              clientEmail: FIREBASE_CLIENT_EMAIL,
            }),
          });
    messagingInstance = admin.messaging(app);
    return messagingInstance;
  } catch (err) {
    console.error('[pushService] Firebase init error:', err);
    return null;
  }
}

// ==================== Types ====================

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface PushResult {
  success: boolean;
  fcmMessageId?: string;
  error?: string;
}

// ==================== Register / Unregister Tokens ====================

export async function registerPushToken(
  userId: string,
  token: string,
  platform: string,
  deviceInfo?: Record<string, unknown>,
): Promise<void> {
  await prisma.pushToken.upsert({
    where: { userId_token: { userId, token } },
    update: {
      isActive: true,
      platform,
      lastUsedAt: new Date(),
      deviceInfo: (deviceInfo as any) ?? undefined,
    },
    create: {
      userId,
      token,
      platform,
      isActive: true,
      deviceInfo: (deviceInfo as any) ?? undefined,
    },
  });
}

export async function deactivatePushToken(token: string): Promise<void> {
  await prisma.pushToken.updateMany({
    where: { token },
    data: { isActive: false },
  });
}

// ==================== Send to a single token ====================

async function sendToToken(
  tokenId: string,
  token: string,
  payload: PushPayload,
  platform: string,
): Promise<PushResult> {
  const messaging = await getMessaging();

  if (!messaging) {
    // Dev mode — log and return mock success
    console.log(`\n🔔 [PUSH DEV] To: ${token.slice(0, 20)}…`);
    console.log(`   Title  : ${payload.title}`);
    console.log(`   Body   : ${payload.body}\n`);
    return { success: true, fcmMessageId: 'dev' };
  }

  try {
    const messageId = await messaging.send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
      data: payload.data ?? {},
      webpush: platform === 'web' ? { notification: { icon: '/icons/icon-192x192.png' } } : undefined,
    });

    // Update lastUsedAt
    await prisma.pushToken.updateMany({
      where: { token },
      data: { lastUsedAt: new Date() },
    });

    return { success: true, fcmMessageId: messageId };
  } catch (err: unknown) {
    const errorCode = (err as { code?: string })?.code ?? 'unknown';
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';

    // Deactivate invalid/expired tokens automatically
    if (
      errorCode === 'messaging/registration-token-not-registered' ||
      errorCode === 'messaging/invalid-registration-token'
    ) {
      await prisma.pushToken.updateMany({ where: { token }, data: { isActive: false } });
    }

    return { success: false, error: errorMsg };
  }
}

// ==================== Log notification ====================

async function logNotification(params: {
  userId?: string;
  tokenId: string;
  eventType: string;
  title: string;
  body: string;
  platform: string;
  status: string;
  fcmMessageId?: string;
  errorCode?: string;
}): Promise<void> {
  try {
    await prisma.notificationLog.create({
      data: {
        userId: params.userId ?? undefined,
        tokenId: params.tokenId,
        eventType: params.eventType,
        title: params.title,
        body: params.body,
        platform: params.platform,
        status: params.status,
        fcmMessageId: params.fcmMessageId ?? undefined,
        errorCode: params.errorCode ?? undefined,
      },
    });
  } catch {
    // Non-blocking
  }
}

// ==================== Send to all active tokens for a user ====================

export async function sendToUser(
  userId: string,
  eventType: string,
  payload: PushPayload,
): Promise<PushResult[]> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId, isActive: true },
  });

  if (tokens.length === 0) return [];

  const results: PushResult[] = [];

  for (const t of tokens) {
    const result = await sendToToken(t.id, t.token, payload, t.platform);
    await logNotification({
      userId,
      tokenId: t.id,
      eventType,
      title: payload.title,
      body: payload.body,
      platform: t.platform,
      status: result.success ? 'sent' : 'failed',
      fcmMessageId: result.fcmMessageId,
      errorCode: result.error,
    });
    results.push(result);
  }

  return results;
}

// ==================== Convenience wrappers ====================

export async function notifyNewAppointment(userId: string, details: string): Promise<void> {
  await sendToUser(userId, 'rdv_confirmed', {
    title: 'Rendez-vous confirmé ✓',
    body: details,
    data: { type: 'rdv_confirmed' },
  });
}

export async function notifyAppointmentReminder(userId: string, details: string): Promise<void> {
  await sendToUser(userId, 'rdv_reminder', {
    title: 'Rappel rendez-vous demain ⏰',
    body: details,
    data: { type: 'rdv_reminder' },
  });
}

export async function notifySecurityEvent(
  userId: string,
  eventType: string,
  message: string,
): Promise<void> {
  await sendToUser(userId, eventType, {
    title: '⚠ Alerte de sécurité',
    body: message,
    data: { type: 'security' },
  });
}
