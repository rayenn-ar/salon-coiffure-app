import { Resend } from 'resend';
import prisma from '../config/database';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const EMAIL_FROM = process.env.EMAIL_FROM || 'Salon de Coiffure <noreply@salon-beaute.fr>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ==================== Types ====================

export interface EmailResult {
  success: boolean;
  providerId?: string;
  error?: string;
}

// ==================== Internal logging ====================

async function logEmail(params: {
  recipient: string;
  subject: string;
  templateName: string;
  providerId?: string;
  status: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        recipient: params.recipient,
        subject: params.subject,
        templateName: params.templateName,
        providerId: params.providerId,
        status: params.status,
        errorMessage: params.errorMessage,
        metadata: (params.metadata as any) ?? undefined,
      },
    });
  } catch {
    // Non-blocking — log failure must not affect request flow
  }
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  templateName: string;
  metadata?: Record<string, unknown>;
}): Promise<EmailResult> {
  // Development mode without API key — log to console only
  if (!resend) {
    console.log(`\n📧 [EMAIL DEV] To: ${params.to}`);
    console.log(`   Subject : ${params.subject}`);
    console.log(`   Template: ${params.templateName}\n`);
    await logEmail({ ...params, status: 'dev_skipped', recipient: params.to });
    return { success: true, providerId: 'dev' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      await logEmail({ ...params, status: 'failed', errorMessage: error.message, recipient: params.to });
      return { success: false, error: error.message };
    }

    await logEmail({ ...params, providerId: data?.id, status: 'sent', recipient: params.to });
    return { success: true, providerId: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await logEmail({ ...params, status: 'failed', errorMessage: msg, recipient: params.to });
    return { success: false, error: msg };
  }
}

// ==================== Base HTML Template ====================

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Salon de Coiffure</title>
</head>
<body style="margin:0;padding:0;background:#f8f4f0;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#C4A882,#9d7a5a);padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">&#9986; Salon de Coiffure</h1>
    </div>
    <div style="padding:32px;">
      ${content}
    </div>
    <div style="background:#f8f4f0;padding:20px 32px;text-align:center;border-top:1px solid #e8e0d8;">
      <p style="margin:0;color:#888;font-size:12px;">
        &copy; ${new Date().getFullYear()} Salon de Coiffure &middot;
        <a href="${FRONTEND_URL}" style="color:#C4A882;text-decoration:none;">Visiter notre site</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ==================== OTP Verification ====================

export async function sendOtpCode(
  email: string,
  code: string,
  expiresInMinutes = 10,
): Promise<EmailResult> {
  const html = baseTemplate(`
    <h2 style="color:#333;margin:0 0 8px;">Code de v&eacute;rification</h2>
    <p style="color:#666;margin:0 0 24px;">
      Utilisez ce code pour cr&eacute;er votre compte. Il expire dans <strong>${expiresInMinutes} minutes</strong>.
    </p>
    <div style="background:#f8f4f0;border-radius:8px;padding:24px;text-align:center;margin:0 0 24px;">
      <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#9d7a5a;font-family:monospace;">${code}</span>
    </div>
    <p style="color:#999;font-size:13px;margin:0;">
      Si vous n&apos;avez pas demand&eacute; ce code, ignorez cet email.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: 'Votre code de v\u00e9rification \u2014 Salon de Coiffure',
    html,
    templateName: 'otp-verification',
    metadata: { expiresInMinutes },
  });
}

// ==================== Welcome ====================

export async function sendWelcome(email: string, prenom: string): Promise<EmailResult> {
  const html = baseTemplate(`
    <h2 style="color:#333;margin:0 0 8px;">Bienvenue, ${prenom}&nbsp;! &#127881;</h2>
    <p style="color:#666;margin:0 0 24px;">
      Votre compte a &eacute;t&eacute; cr&eacute;&eacute; avec succ&egrave;s.
      Vous pouvez d&eacute;sormais r&eacute;server vos rendez-vous en ligne.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${FRONTEND_URL}/reservation"
         style="background:#C4A882;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
        Prendre un rendez-vous
      </a>
    </div>
    <p style="color:#999;font-size:13px;margin:0;">
      Besoin d&apos;aide&nbsp;?
      <a href="mailto:contact@salon-beaute.fr" style="color:#C4A882;">Contactez-nous</a>
    </p>
  `);

  return sendEmail({
    to: email,
    subject: 'Bienvenue au Salon de Coiffure\u00a0!',
    html,
    templateName: 'welcome',
    metadata: { prenom },
  });
}

// ==================== Security Alert ====================

type SecurityAlertType = 'new_login' | 'password_changed' | 'duplicate_registration_attempt' | 'mfa_changed';

export async function sendSecurityAlert(
  email: string,
  type: SecurityAlertType,
  data?: Record<string, unknown>,
): Promise<EmailResult> {
  const messages: Record<SecurityAlertType, string> = {
    new_login: `Une nouvelle connexion a &eacute;t&eacute; d&eacute;tect&eacute;e sur votre compte${data?.ip ? ` depuis ${data.ip}` : ''}.`,
    password_changed: 'Votre mot de passe a &eacute;t&eacute; modifi&eacute;. Si ce n&apos;est pas vous, contactez-nous imm&eacute;diatement.',
    duplicate_registration_attempt: 'Une tentative d&apos;inscription a &eacute;t&eacute; effectu&eacute;e avec votre adresse email.',
    mfa_changed: 'La configuration de votre double authentification a chang&eacute;.',
  };

  const html = baseTemplate(`
    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:16px;margin:0 0 20px;">
      <strong style="color:#856404;">&#9888; Alerte de s&eacute;curit&eacute;</strong>
    </div>
    <p style="color:#333;margin:0 0 16px;">${messages[type]}</p>
    <p style="color:#666;font-size:13px;margin:0 0 24px;">
      Date et heure&nbsp;: ${new Date().toLocaleString('fr-FR')}
    </p>
    <p style="color:#999;font-size:13px;margin:0;">
      Ce n&apos;est pas vous&nbsp;?
      <a href="${FRONTEND_URL}/mot-de-passe-oublie" style="color:#C4A882;">S&eacute;curisez votre compte</a>
    </p>
  `);

  return sendEmail({
    to: email,
    subject: '\u26a0 Alerte de s\u00e9curit\u00e9 \u2014 Salon de Coiffure',
    html,
    templateName: 'security-alert',
    metadata: { type, ...data },
  });
}

// ==================== Password Reset ====================

export async function sendPasswordReset(email: string, resetUrl: string): Promise<EmailResult> {
  const html = baseTemplate(`
    <h2 style="color:#333;margin:0 0 8px;">R&eacute;initialisation du mot de passe</h2>
    <p style="color:#666;margin:0 0 24px;">
      Vous avez demand&eacute; la r&eacute;initialisation de votre mot de passe.
      Cliquez sur le bouton ci-dessous (lien valable <strong>1 heure</strong>).
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${resetUrl}"
         style="background:#C4A882;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
        R&eacute;initialiser mon mot de passe
      </a>
    </div>
    <p style="color:#999;font-size:13px;margin:0;">
      Si vous n&apos;avez pas demand&eacute; cette r&eacute;initialisation, ignorez cet email.
    </p>
  `);

  return sendEmail({
    to: email,
    subject: 'R\u00e9initialisation de votre mot de passe',
    html,
    templateName: 'password-reset',
    metadata: {},
  });
}

// ==================== Appointment Confirmation ====================

export async function sendAppointmentConfirmation(data: {
  email: string;
  prenom: string;
  coiffeuse: string;
  services: string[];
  dateHeure: Date;
  dureeMinutes: number;
  prixTotal: number;
}): Promise<EmailResult> {
  const dateStr = data.dateHeure.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const heureStr = data.dateHeure.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const html = baseTemplate(`
    <h2 style="color:#333;margin:0 0 8px;">Rendez-vous confirm&eacute; &#10003;</h2>
    <p style="color:#666;margin:0 0 24px;">
      Bonjour ${data.prenom}, votre rendez-vous a bien &eacute;t&eacute; enregistr&eacute;.
    </p>
    <div style="background:#f8f4f0;border-radius:8px;padding:20px;margin:0 0 24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#888;font-size:14px;">Date</td><td style="padding:6px 0;color:#333;font-weight:600;">${dateStr}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:14px;">Heure</td><td style="padding:6px 0;color:#333;font-weight:600;">${heureStr}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:14px;">Coiffeuse</td><td style="padding:6px 0;color:#333;font-weight:600;">${data.coiffeuse}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:14px;">Services</td><td style="padding:6px 0;color:#333;font-weight:600;">${data.services.join(', ')}</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:14px;">Dur&eacute;e</td><td style="padding:6px 0;color:#333;font-weight:600;">${data.dureeMinutes} min</td></tr>
        <tr><td style="padding:6px 0;color:#888;font-size:14px;">Prix total</td><td style="padding:6px 0;color:#C4A882;font-weight:700;">${data.prixTotal}&nbsp;&euro;</td></tr>
      </table>
    </div>
    <p style="color:#999;font-size:13px;margin:0;">
      Annulation possible jusqu&apos;&agrave; 24h avant.
      <a href="${FRONTEND_URL}/mon-espace" style="color:#C4A882;">G&eacute;rer mes rendez-vous</a>
    </p>
  `);

  return sendEmail({
    to: data.email,
    subject: `Rendez-vous confirm\u00e9 \u2014 ${dateStr} \u00e0 ${heureStr}`,
    html,
    templateName: 'rdv-confirmation',
    metadata: { dateHeure: data.dateHeure.toISOString(), prixTotal: data.prixTotal },
  });
}

// ==================== Appointment Reminder ====================

export async function sendAppointmentReminder(data: {
  email: string;
  prenom: string;
  coiffeuse: string;
  services: string[];
  dateHeure: Date;
}): Promise<EmailResult> {
  const dateStr = data.dateHeure.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const heureStr = data.dateHeure.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const html = baseTemplate(`
    <h2 style="color:#333;margin:0 0 8px;">Rappel&nbsp;: rendez-vous demain &#9200;</h2>
    <p style="color:#666;margin:0 0 24px;">
      Bonjour ${data.prenom}, n&apos;oubliez pas votre rendez-vous demain.
    </p>
    <div style="background:#f8f4f0;border-radius:8px;padding:20px;margin:0 0 24px;">
      <p style="margin:0;color:#333;"><strong>${dateStr} &agrave; ${heureStr}</strong></p>
      <p style="margin:8px 0 0;color:#666;font-size:14px;">
        Avec ${data.coiffeuse} &middot; ${data.services.join(', ')}
      </p>
    </div>
    <p style="color:#999;font-size:13px;margin:0;">
      Annulation uniquement avant 24h.
      <a href="${FRONTEND_URL}/mon-espace" style="color:#C4A882;">Mon espace</a>
    </p>
  `);

  return sendEmail({
    to: data.email,
    subject: `Rappel\u00a0: rendez-vous demain \u00e0 ${heureStr}`,
    html,
    templateName: 'rdv-reminder',
    metadata: { dateHeure: data.dateHeure.toISOString() },
  });
}

// ==================== Stock Alert (Admin) ====================

export async function sendStockAlert(
  adminEmail: string,
  products: Array<{ nom: string; quantiteActuelle: number; seuilAlerte: number; unite: string }>,
): Promise<EmailResult> {
  const rows = products
    .map(
      (p) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #e8e0d8;">${p.nom}</td>
          <td style="padding:8px;border-bottom:1px solid #e8e0d8;color:#e74c3c;font-weight:600;">
            ${p.quantiteActuelle} ${p.unite}
          </td>
          <td style="padding:8px;border-bottom:1px solid #e8e0d8;color:#888;">${p.seuilAlerte} ${p.unite}</td>
        </tr>`,
    )
    .join('');

  const html = baseTemplate(`
    <h2 style="color:#333;margin:0 0 8px;">&#9888; Alerte stock faible</h2>
    <p style="color:#666;margin:0 0 24px;">
      Les produits suivants sont en dessous du seuil d&apos;alerte&nbsp;:
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#f8f4f0;">
          <th style="padding:8px;text-align:left;color:#888;">Produit</th>
          <th style="padding:8px;text-align:left;color:#888;">Stock actuel</th>
          <th style="padding:8px;text-align:left;color:#888;">Seuil alerte</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:center;margin:24px 0;">
      <a href="${FRONTEND_URL}/admin"
         style="background:#C4A882;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
        G&eacute;rer le stock
      </a>
    </div>
  `);

  return sendEmail({
    to: adminEmail,
    subject: `\u26a0 ${products.length} produit(s) en stock faible`,
    html,
    templateName: 'stock-alert',
    metadata: { count: products.length },
  });
}
