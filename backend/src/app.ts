import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes';
import serviceRoutes from './routes/serviceRoutes';
import coiffeuseRoutes from './routes/coiffeuseRoutes';
import rendezVousRoutes from './routes/rendezVousRoutes';
import clienteRoutes from './routes/clienteRoutes';
import adminRoutes from './routes/adminRoutes';
import mfaRoutes from './routes/mfaRoutes';
import testRoutes from './routes/testRoutes';
import pushRoutes from './routes/pushRoutes';
import userRoutes from './routes/userRoutes';
import webhookRoutes from './routes/webhookRoutes';
import { errorHandler } from './middleware/errorHandler';
import { rateLimitGlobal } from './middleware/rateLimit';
import { csrfProtection } from './middleware/csrf';

dotenv.config();

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// ==================== Security Headers (OWASP) ====================

app.use((req, res, next) => {
  // Generate nonce for CSP
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (_req: any, res: any) => `'nonce-${res.locals.cspNonce}'`],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", ...(isProd ? [] : ['http://localhost:3001'])],
        fontSrc: ["'self'", 'https:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    } as any,
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    noSniff: true,
  })
);

// Additional security headers
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  next();
});

// ==================== CORS ====================

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  })
);

// ==================== Parsing ====================

app.use(cookieParser());

// Capture raw body for webhook signature verification (Resend)
// Must be registered BEFORE express.json() so the webhook handler can read the raw bytes.
app.use('/api/webhooks', (req, res, next) => {
  let buf = Buffer.alloc(0);
  req.on('data', (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk]);
  });
  req.on('end', () => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    next();
  });
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ==================== Rate Limiting (Redis-based) ====================

app.use('/api/', rateLimitGlobal());

// ==================== CSRF Protection ====================

if (isProd) {
  app.use('/api/', csrfProtection());
}

// ==================== Logging ====================

if (!isProd) {
  app.use(morgan('dev'));
}

// ==================== Health Check ====================

app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ==================== API Routes ====================

app.use('/api/auth', authRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/coiffeuses', coiffeuseRoutes);
app.use('/api/rendez-vous', rendezVousRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/user', userRoutes);

// Webhooks — mounted before CSRF middleware (raw body required, no session)
app.use('/api/webhooks', webhookRoutes);

if (!isProd) {
  app.use('/api/test', testRoutes);
}

// Route publique (sans auth) — paramètres salon pour le footer
import prisma from './config/database';
app.get('/api/public/parametres', async (_req, res) => {
  try {
    let params = await prisma.salonParametres.findFirst();
    if (!params) params = await prisma.salonParametres.create({ data: {} });
    res.json({
      success: true,
      data: {
        nomSalon: params.nomSalon,
        slogan: params.slogan,
        adresse: params.adresse,
        ville: params.ville,
        telephone: params.telephone,
        emailContact: params.emailContact,
        googleMapsUrl: params.googleMapsUrl,
        horaireOuverture: params.horaireOuverture,
      },
    });
  } catch {
    res.json({ success: true, data: {} });
  }
});

// Gestion erreurs
app.use(errorHandler);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route non trouvée' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 API Salon de Coiffure démarrée sur http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

export default app;
