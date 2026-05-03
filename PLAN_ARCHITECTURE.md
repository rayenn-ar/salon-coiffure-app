# PLAN D'ARCHITECTURE — ÉVOLUTION PLATEFORME SALON DE COIFFURE
## Système Email · Authentification OTP · Multi-plateforme · Notifications Push

**Version** : 1.0 — Document de planification pré-implémentation  
**Date** : 2026-04-28  
**Statut** : EN ATTENTE DE VALIDATION  
**Auteur** : Architecte logiciel senior

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble et stack technique](#1-vue-densemble-et-stack-technique)
2. [Architecture système — Diagramme des flux](#2-architecture-système--diagramme-des-flux)
3. [Schéma de base de données — Nouvelles tables](#3-schéma-de-base-de-données--nouvelles-tables)
4. [Flow d'authentification complet avec OTP](#4-flow-dauthentification-complet-avec-otp)
5. [Système d'emails transactionnels](#5-système-demails-transactionnels)
6. [Stratégie de notifications push cross-plateforme](#6-stratégie-de-notifications-push-cross-plateforme)
7. [Stratégie de packaging multi-plateforme](#7-stratégie-de-packaging-multi-plateforme)
8. [Sécurité applicative — Couches de protection](#8-sécurité-applicative--couches-de-protection)
9. [Conformité RGPD](#9-conformité-rgpd)
10. [Plan de déploiement et CI/CD](#10-plan-de-déploiement-et-cicd)
11. [Estimation des coûts mensuels](#11-estimation-des-coûts-mensuels)
12. [Phases d'implémentation](#12-phases-dimplémentation)

---

## 1. VUE D'ENSEMBLE ET STACK TECHNIQUE

### 1.1 État actuel du projet

Le projet est une application de gestion de salon de coiffure basée sur :

| Couche | Technologie | Version |
|---|---|---|
| Frontend | Next.js (App Router) | 16.2.3 |
| Backend | Express.js + TypeScript | 4.x |
| Base de données | PostgreSQL + Prisma ORM | 6.x |
| Cache / Sessions | Redis | 7.x |
| Authentification | JWT RS256 + TOTP MFA | — |
| Tests E2E | Playwright | — |

### 1.2 Stack technique cible après évolution

#### Service Email — Choix : **Resend**

**Justification vs alternatives :**

| Critère | Resend | AWS SES | SendGrid |
|---|---|---|---|
| SDK TypeScript natif | Oui (first-class) | Non (SDK générique) | Oui |
| Configuration DNS simplifiée | Oui | Complexe | Moyen |
| Tarif entrée (< 3000 emails/mois) | **Gratuit** | 0,10$/1000 | 100/mois gratuit |
| Webhooks de délivrabilité | Oui | Via SNS (complexe) | Oui |
| Templates React (React Email) | Oui natif | Non | Non |
| Réputation IP partagée | Bonne | Excellente | Bonne |

**Décision : Resend** pour sa DX supérieure avec TypeScript, son intégration React Email pour les templates, et sa gratuité au démarrage.

#### Framework Push Notifications — Choix : **Firebase Cloud Messaging (FCM)**

**Justification :**
- FCM unifie Android, iOS (via APNs gateway), et Web dans un seul SDK
- Évite de gérer séparément APNs et WebPush VAPID
- Service gratuit jusqu'à très haute volumétrie
- Alternative (Web VAPID direct) maintenue uniquement pour le web si FCM trop lourd

#### Packaging multi-plateforme — Choix : **Tauri (Desktop) + Capacitor (Mobile)**

**Justification Tauri vs Electron :**
- Tauri : binaire 3–10 Mo vs 150–200 Mo Electron, empreinte mémoire 10× inférieure
- Tauri utilise le WebView système (WKWebView sur Mac, WebView2 sur Windows) → sécurité OS
- Tauri est écrit en Rust → pas de vulnérabilités type Prototype Pollution
- Electron : encore pertinent si codebase Node.js lourde côté main process, non applicable ici

**Justification Capacitor vs React Native :**
- Capacitor réutilise 100% du code Next.js/React existant sans réécriture
- React Native nécessiterait une réécriture complète de tous les composants UI
- Capacitor = wrapper WebView natif avec accès aux APIs natives via plugins
- Performance suffisante pour une app de gestion (pas un jeu 3D)

---

## 2. ARCHITECTURE SYSTÈME — DIAGRAMME DES FLUX

### 2.1 Vue générale de l'architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Web PWA │  │ Desktop  │  │ Android  │  │     iOS      │   │
│  │(Next.js) │  │ (Tauri)  │  │(Capacitor│  │ (Capacitor)  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
└───────┼─────────────┼─────────────┼────────────────┼───────────┘
        │             │             │                │
        └─────────────┴─────────────┴────────────────┘
                              │ HTTPS / TLS 1.3
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND — Next.js 16                        │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  App Router │  │  proxy.ts    │  │   Service Worker       │ │
│  │  (SSR/SSG)  │  │  (JWT check) │  │   (PWA + Push Web)     │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
│  localhost:3000                                                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Rewrites → /api/*
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND — Express.js                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │ authRoutes│ │ mfaRoutes│ │ emailSvc │ │ pushNotifService   │ │
│  │ (OTP/JWT) │ │ (TOTP)   │ │ (Resend) │ │ (FCM Admin SDK)    │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘ │
│  localhost:3001                                                  │
└──────┬──────────┬───────────┬────────────────────────┬──────────┘
       │          │           │                        │
       ▼          ▼           ▼                        ▼
┌──────────┐ ┌────────┐ ┌─────────────┐  ┌──────────────────────┐
│ PostgreSQL│ │ Redis  │ │   Resend    │  │ Firebase Cloud       │
│ (Prisma) │ │(Sessions│ │ (SMTP API)  │  │ Messaging (FCM)      │
│          │ │ OTP TTL)│ │             │  │ + APNs Gateway       │
└──────────┘ └────────┘ └─────────────┘  └──────────────────────┘
```

### 2.2 Flux de données — Inscription avec OTP

```
Utilisateur         Frontend            Backend             Redis       Email       DB
    │                   │                   │                 │           │          │
    │── saisit email ──►│                   │                 │           │          │
    │                   │── POST /auth/     │                 │           │          │
    │                   │   request-otp ───►│                 │           │          │
    │                   │                   │── vérif email ─────────────────────►  │
    │                   │                   │◄── n'existe pas ───────────────────── │
    │                   │                   │── générer OTP ──►│           │         │
    │                   │                   │   SETEX(10min)  │           │         │
    │                   │                   │── envoyer ──────────────────►         │
    │                   │◄── 200 OK ────────│                 │           │         │
    │◄── "Code envoyé" ─│                   │                 │           │         │
    │                   │                   │                 │           │         │
    │── saisit code ───►│                   │                 │           │         │
    │                   │── POST /auth/     │                 │           │         │
    │                   │   verify-otp ────►│                 │           │         │
    │                   │                   │── GET code ────►│           │         │
    │                   │                   │◄── code + TTL ──│           │         │
    │                   │                   │── vérif code ───│           │         │
    │                   │                   │── DEL code ────►│           │         │
    │                   │◄── otpToken (JWT court durée) ──────│           │         │
    │◄── form mot passe ─│                  │                 │           │         │
    │                   │                   │                 │           │         │
    │── saisit mdp ────►│                   │                 │           │         │
    │                   │── POST /auth/     │                 │           │         │
    │                   │   complete-reg ──►│                 │           │         │
    │                   │  (otpToken + mdp) │                 │           │         │
    │                   │                   │── Argon2id hash │           │         │
    │                   │                   │── CREATE user ─────────────────────►  │
    │                   │                   │── email bienvenue──────────►          │
    │                   │◄── access_token   │                 │           │         │
    │                   │    + refresh ─────│                 │           │         │
    │◄── connecté ──────│                   │                 │           │         │
```

---

## 3. SCHÉMA DE BASE DE DONNÉES — NOUVELLES TABLES

### 3.1 Table `email_verification_codes` (en Redis, pas en DB)

Les codes OTP sont stockés **exclusivement en Redis** avec TTL pour garantir l'expiration automatique. Structure de la clé Redis :

```
Clé    : otp:{email_hash}
Valeur : JSON { code_hash, attempts, created_at, purpose }
TTL    : 600 secondes (10 minutes)
```

**Pourquoi Redis et non PostgreSQL ?**
- Expiration atomique garantie par Redis SETEX
- Pas de job de nettoyage à maintenir
- Lecture O(1), pas de scan de table
- Pas de risque de fuite via backup DB

### 3.2 Table `email_logs` (PostgreSQL)

```sql
CREATE TABLE email_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id      UUID NOT NULL DEFAULT gen_random_uuid(),  -- ID Resend
  recipient     VARCHAR(255) NOT NULL,  -- email du destinataire
  subject       VARCHAR(500) NOT NULL,
  template_name VARCHAR(100) NOT NULL,  -- 'welcome', 'otp', 'security-alert', etc.
  status        VARCHAR(50) NOT NULL DEFAULT 'sent',  -- sent|delivered|bounced|failed
  provider_id   VARCHAR(255),  -- ID retourné par Resend
  error_message TEXT,
  metadata      JSONB,         -- données contextuelles non sensibles
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at  TIMESTAMPTZ,
  bounced_at    TIMESTAMPTZ,

  INDEX idx_email_logs_recipient (recipient),
  INDEX idx_email_logs_trace_id (trace_id),
  INDEX idx_email_logs_status (status),
  INDEX idx_email_logs_sent_at (sent_at)
);
```

### 3.3 Table `push_notification_tokens`

```sql
CREATE TABLE push_notification_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL,            -- FCM token ou VAPID endpoint
  platform     VARCHAR(20) NOT NULL,     -- 'web'|'android'|'ios'|'desktop'
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  device_info  JSONB,                    -- user-agent, modèle, OS version
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, token),
  INDEX idx_push_tokens_user_id (user_id),
  INDEX idx_push_tokens_platform (platform)
);
```

### 3.4 Table `notification_logs`

```sql
CREATE TABLE notification_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type    VARCHAR(100) NOT NULL,   -- 'new_login'|'password_change'|'otp_sent'
  title         VARCHAR(255) NOT NULL,
  body          TEXT NOT NULL,
  platform      VARCHAR(20) NOT NULL,
  token_id      UUID REFERENCES push_notification_tokens(id),
  status        VARCHAR(50) NOT NULL,    -- 'sent'|'delivered'|'failed'|'skipped'
  fcm_message_id VARCHAR(255),
  error_code    VARCHAR(100),
  sent_at       TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_notif_logs_user_id (user_id),
  INDEX idx_notif_logs_event_type (event_type),
  INDEX idx_notif_logs_sent_at (sent_at)
);
```

### 3.5 Nouvelles colonnes sur la table `users` existante

```sql
-- Ajout via migration Prisma
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

-- Pour les comptes existants (migration de données)
UPDATE users SET email_verified = TRUE, email_verified_at = created_at;
```

### 3.6 Table `otp_pending_registrations` (PostgreSQL — fallback Redis)

En cas d'indisponibilité Redis, stockage temporaire en base :

```sql
CREATE TABLE otp_pending_registrations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 de l'email
  code_hash  VARCHAR(255) NOT NULL,        -- bcrypt du code OTP
  attempts   INT NOT NULL DEFAULT 0,
  purpose    VARCHAR(50) NOT NULL,         -- 'registration'|'password_reset'
  expires_at TIMESTAMPTZ NOT NULL,         -- NOW() + 10 minutes
  created_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_otp_pending_expires (expires_at)
);
```

---

## 4. FLOW D'AUTHENTIFICATION COMPLET AVEC OTP

### 4.1 ÉTAPE 1 — Demande de code OTP (inscription uniquement)

```
ENDPOINT : POST /api/auth/request-otp
RATE LIMIT : 1 requête / 60 secondes par IP + email (Redis sliding window)

INPUT  : { email: string }
OUTPUT : { success: true, message: "Code envoyé" }
         OU { success: false, error: "generic_error" }  // toujours générique

PSEUDO-CODE SÉCURISÉ :
────────────────────────────────────────────────────────
function requestOtp(email: string, ip: string): Result {

  // 1. Validation format email
  if (!isValidEmail(email)) throw BadRequest("Format invalide");

  // 2. Rate limiting (clé Redis : rate:otp:{ip}:{email_hash})
  const rateLimitKey = `rate:otp:${ip}:${sha256(email)}`;
  const lastSent = await redis.get(rateLimitKey);
  if (lastSent && Date.now() - lastSent < 60_000) {
    throw TooManyRequests("Attendez 60 secondes entre deux envois");
  }

  // 3. Vérification email non déjà utilisé
  //    Message GÉNÉRIQUE pour éviter l'énumération
  const existing = await db.user.findUnique({ where: { email } });
  // NE PAS révéler l'existence — répondre toujours "code envoyé"
  if (existing && existing.emailVerified) {
    // Email déjà enregistré : envoyer un email de sécurité différent
    //   "Tentative de réinscription avec votre email"
    // mais répondre la MÊME chose au frontend
    await emailService.sendSecurityAlert(email, "duplicate_registration_attempt");
    return { success: true, message: "Code envoyé si email valide" };
  }

  // 4. Génération code OTP cryptographiquement sûr
  const code = crypto.randomInt(100_000, 999_999).toString();  // 6 chiffres
  const codeHash = await bcrypt.hash(code, 10);

  // 5. Stockage en Redis avec TTL 10 minutes
  const otpKey = `otp:${sha256(email)}`;
  await redis.setEx(otpKey, 600, JSON.stringify({
    codeHash,
    attempts: 0,
    createdAt: Date.now(),
    purpose: "registration"
  }));

  // 6. Rate limiting : marquer l'envoi
  await redis.setEx(rateLimitKey, 60, Date.now().toString());

  // 7. Envoi email asynchrone (ne pas bloquer la réponse)
  emailQueue.push({ type: "otp", email, code, expiresInMinutes: 10 });

  // 8. Réponse générique
  return { success: true, message: "Code envoyé si email valide" };
}
```

### 4.2 ÉTAPE 2 — Vérification du code OTP

```
ENDPOINT : POST /api/auth/verify-otp
RATE LIMIT : 3 tentatives max, puis blocage 15 minutes

INPUT  : { email: string, code: string }
OUTPUT : { success: true, otpToken: string }  // JWT 5 minutes
         OU { success: false, error: string, remainingAttempts: number }

PSEUDO-CODE SÉCURISÉ :
────────────────────────────────────────────────────────
function verifyOtp(email: string, code: string): Result {

  // 1. Récupération données OTP
  const otpKey = `otp:${sha256(email)}`;
  const otpData = await redis.get(otpKey);
  if (!otpData) throw Unauthorized("Code expiré ou invalide");

  const { codeHash, attempts, purpose } = JSON.parse(otpData);

  // 2. Vérification tentatives
  if (attempts >= 3) {
    await redis.del(otpKey);  // Invalider après 3 échecs
    throw TooManyRequests("Trop de tentatives. Demandez un nouveau code.");
  }

  // 3. Comparaison temps-constant (anti-timing attack)
  const isValid = await bcrypt.compare(code, codeHash);
  if (!isValid) {
    // Incrémenter le compteur
    await redis.setEx(otpKey, await redis.ttl(otpKey), JSON.stringify({
      ...JSON.parse(otpData),
      attempts: attempts + 1
    }));
    throw Unauthorized(`Code invalide. ${2 - attempts} tentative(s) restante(s).`);
  }

  // 4. Code valide — invalider immédiatement (one-time use)
  await redis.del(otpKey);

  // 5. Générer un otpToken (JWT court, 5 minutes, signé RS256)
  //    Contient : email, purpose, iat, exp
  //    NE CONTIENT PAS d'identifiant de session (pas encore de compte)
  const otpToken = jwt.sign(
    { email, purpose, verified: true },
    privateKey,
    { algorithm: "RS256", expiresIn: "5m", audience: "otp-completion" }
  );

  return { success: true, otpToken };
}
```

### 4.3 ÉTAPE 3 — Création de compte (après OTP validé)

```
ENDPOINT : POST /api/auth/complete-registration
AUTH    : Bearer otpToken (JWT 5min émis par verify-otp)

INPUT  : { password: string, confirmPassword: string, nom: string, prenom: string, telephone: string }
OUTPUT : { success: true, accessToken: string, user: UserDTO }

PSEUDO-CODE SÉCURISÉ :
────────────────────────────────────────────────────────
function completeRegistration(otpToken: string, data: RegisterDTO): Result {

  // 1. Vérification otpToken
  const payload = jwt.verify(otpToken, publicKey, {
    algorithms: ["RS256"],
    audience: "otp-completion"
  });
  if (payload.purpose !== "registration") throw Forbidden("Token invalide");

  const email = payload.email;

  // 2. Double-vérification : email toujours disponible
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw Conflict("Compte déjà créé");

  // 3. Validation politique mot de passe
  validatePassword(data.password);
  // Règles : ≥ 12 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 symbole
  // Vérification via zxcvbn (score ≥ 3 requis)
  // Vérification HIBP (Have I Been Pwned) optionnelle

  if (data.password !== data.confirmPassword) throw BadRequest("Mots de passe différents");

  // 4. Hashage Argon2id (supérieur à bcrypt pour les GPU attacks)
  const passwordHash = await argon2.hash(data.password, {
    type: argon2.argon2id,
    memoryCost: 65536,   // 64 MiB
    timeCost: 3,
    parallelism: 4,
  });

  // 5. Création atomique en base (transaction)
  const user = await db.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        password: passwordHash,
        role: "CLIENTE",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        cliente: {
          create: {
            nom: sanitize(data.nom),
            prenom: sanitize(data.prenom),
            telephone: data.telephone,
          }
        }
      }
    });
    // Log audit
    await tx.auditLog.create({
      data: { userId: newUser.id, action: "REGISTER_SUCCESS", success: true }
    });
    return newUser;
  });

  // 6. Génération tokens de session
  const { accessToken, refreshToken } = generateSessionTokens(user);

  // 7. Email de bienvenue (asynchrone)
  emailQueue.push({ type: "welcome", email, prenom: data.prenom });

  // 8. Notification push (si token enregistré)
  pushService.sendToUser(user.id, {
    title: "Bienvenue !",
    body: "Votre compte a été créé avec succès.",
    event: "account_created"
  });

  return { success: true, accessToken, user: toDTO(user) };
}
```

### 4.4 Connexion classique (après inscription)

```
ENDPOINT : POST /api/auth/login
RATE LIMIT : 5 tentatives / 15 minutes par IP (Redis + IP)
LOCK : Verrouillage compte 30 minutes après 10 échecs globaux

PSEUDO-CODE SÉCURISÉ :
────────────────────────────────────────────────────────
function login(email: string, password: string, ip: string): Result {

  // 1. Vérification rate limit
  checkRateLimit(`login:${ip}`, maxAttempts=5, windowSeconds=900);

  // 2. Récupération utilisateur — temps constant même si non trouvé
  const user = await db.user.findUnique({ where: { email } });

  // 3. Vérification mot de passe (TOUJOURS exécuter même si user=null)
  //    Pour éviter le timing side-channel sur l'existence d'un compte
  const dummyHash = "$argon2id$v=19$...";  // hash pré-calculé
  const hashToVerify = user ? user.password : dummyHash;
  const isValid = await argon2.verify(hashToVerify, password);

  if (!user || !isValid) {
    if (user) incrementFailedAttempts(user.id);
    throw Unauthorized("Identifiants incorrects");
  }

  // 4. Vérification compte actif et email vérifié
  if (!user.actif) throw Forbidden("Compte désactivé");
  if (!user.emailVerified) throw Forbidden("Email non vérifié");

  // 5. MFA : si activé, retourner un pendingToken (pas d'accès complet)
  if (user.isMfaEnabled) {
    const pendingToken = jwt.sign(
      { userId: user.id, mfaRequired: true },
      privateKey,
      { algorithm: "RS256", expiresIn: "5m" }
    );
    return { success: true, mfaRequired: true, pendingToken };
  }

  // 6. Génération session complète
  const sessionId = crypto.randomUUID();
  const accessToken = generateAccessToken({ userId: user.id, sessionId, ... });
  const refreshToken = generateRefreshToken();

  // Stockage session Redis + RefreshToken en DB
  await redis.setEx(`session:${sessionId}`, 900, JSON.stringify({ userId: user.id }));
  await db.refreshToken.create({ data: { userId: user.id, tokenHash: hash(refreshToken), ... } });

  // 7. Notification push — nouvelle connexion
  pushService.sendToUser(user.id, {
    title: "Nouvelle connexion",
    body: `Connexion depuis ${ip} — ${new Date().toLocaleString("fr-FR")}`,
    event: "new_login",
    data: { ip, userAgent: req.headers["user-agent"] }
  });

  // 8. Audit log
  auditLog(user.id, "LOGIN_SUCCESS", { ip, sessionId });

  return { success: true, accessToken, user: toDTO(user) };
}
```

---

## 5. SYSTÈME D'EMAILS TRANSACTIONNELS

### 5.1 Configuration DNS obligatoire

Avant tout envoi, configurer sur le domaine `salon-beaute.fr` :

```dns
; SPF — autorise Resend à envoyer en votre nom
salon-beaute.fr. IN TXT "v=spf1 include:_spf.resend.com ~all"

; DKIM — signature cryptographique des emails (fourni par Resend)
resend._domainkey.salon-beaute.fr. IN TXT "v=DKIM1; k=rsa; p=<clé_publique_resend>"

; DMARC — politique de traitement des emails non conformes
_dmarc.salon-beaute.fr. IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@salon-beaute.fr; ruf=mailto:dmarc@salon-beaute.fr; pct=100; adkim=s; aspf=s"

; MX — serveur de réception (pour DMARC rua/ruf)
salon-beaute.fr. IN MX 10 mail.salon-beaute.fr.
```

**Paramètres DMARC recommandés progressivement :**
- Phase 1 (semaine 1–2) : `p=none` — monitoring sans blocage
- Phase 2 (semaine 3–4) : `p=quarantine; pct=50` — quarantaine partielle
- Phase 3 (définitif) : `p=reject; pct=100` — rejet total des faux emails

### 5.2 Architecture du service email

```
backend/src/services/emailService.ts
├── sendOtpCode(email, code, expiresIn)      → Template 'otp-verification'
├── sendWelcome(email, prenom)               → Template 'welcome'
├── sendSecurityAlert(email, type, data)     → Template 'security-alert'
├── sendPasswordReset(email, resetUrl)       → Template 'password-reset'
├── sendAppointmentConfirmation(rdvData)     → Template 'rdv-confirmation'
├── sendAppointmentReminder(rdvData)         → Template 'rdv-reminder'
└── sendStockAlert(adminEmail, products)     → Template 'stock-alert'
```

### 5.3 Templates email — Stack React Email

```
backend/src/emails/
├── layouts/
│   └── BaseLayout.tsx       → En-tête, pied de page, branding commun
├── templates/
│   ├── OtpVerification.tsx  → Code OTP (grand, centré, monospace)
│   ├── Welcome.tsx          → Email de bienvenue avec CTA
│   ├── SecurityAlert.tsx    → Alerte sécurité (rouge, urgence visible)
│   ├── PasswordReset.tsx    → Lien de réinitialisation (expiration affichée)
│   ├── RdvConfirmation.tsx  → Confirmation de rendez-vous
│   └── RdvReminder.tsx      → Rappel 24h avant rendez-vous
└── index.ts                 → Exports + render function
```

**Spécifications de design des templates :**
- Largeur max : 600px (compatibilité maximale clients email)
- Couleurs : palette du salon (harmonisation avec le frontend)
- Fallback texte brut : obligatoire pour chaque template
- Images : hébergées sur CDN (pas d'attachements inline pour éviter les filtres spam)
- Taille totale email : < 100 Ko (images comprises)

### 5.4 Logique de retry et monitoring

```typescript
// Queue avec retry exponentiel
interface EmailJob {
  id: string;
  template: string;
  recipient: string;
  data: Record<string, unknown>;
  attempts: number;       // 0 au départ
  maxAttempts: number;    // 3 par défaut
  nextRetryAt: Date;
}

// Stratégie retry :
// Tentative 1 : immédiate
// Tentative 2 : +30 secondes
// Tentative 3 : +5 minutes
// Après 3 échecs : marqué 'failed' + alerte admin

// Webhook Resend pour les bounces :
// POST /api/webhooks/email-events
// Traiter : delivered | bounced | complained | failed
```

### 5.5 Traçabilité complète

Chaque email envoyé est loggé en base avec :
- `trace_id` : UUID unique par email (affiché dans les headers Email-ID)
- `provider_id` : ID Resend (pour support en cas de problème)
- `status` : mis à jour via webhook Resend
- `metadata` : données contextuelles non sensibles (type d'événement, userId hashé)

**Données NON stockées dans les logs** :
- Le contenu de l'email (RGPD)
- Le code OTP lui-même (sécurité)
- Le mot de passe de l'utilisateur (évident)

---

## 6. STRATÉGIE DE NOTIFICATIONS PUSH CROSS-PLATEFORME

### 6.1 Architecture Firebase Cloud Messaging (FCM)

```
┌────────────────────────────────────────────────────────────────┐
│                   Backend — pushService.ts                     │
│                                                                │
│  événement métier ──► pushService.sendToUser(userId, payload)  │
│                              │                                 │
│                    ┌─────────┴────────┐                        │
│                    │                  │                        │
│              tokens web         tokens mobile                  │
│              (VAPID direct       (FCM token)                   │
│               ou FCM Web)              │                       │
│                    │                  │                        │
│                    └────────┬─────────┘                        │
│                             ▼                                  │
│                     FCM Admin SDK                              │
│                     sendEachForMulticast()                     │
└─────────────────────────────┬──────────────────────────────────┘
                              │ HTTPS
         ┌────────────────────┼────────────────────────┐
         ▼                    ▼                        ▼
  ┌─────────────┐     ┌──────────────┐        ┌──────────────────┐
  │   FCM Web   │     │     FCM      │        │   FCM iOS        │
  │  (Service   │     │   Android    │        │  (→ APNs         │
  │   Worker)   │     │   (native)   │        │   gateway)       │
  └─────────────┘     └──────────────┘        └──────────────────┘
```

### 6.2 Enregistrement des tokens — Endpoint

```
ENDPOINT : POST /api/push/register-token
AUTH     : Bearer access_token (utilisateur authentifié)

INPUT  : { token: string, platform: 'web'|'android'|'ios'|'desktop' }
OUTPUT : { success: true }

LOGIQUE :
- Upsert du token en DB (éviter les doublons)
- Si token existant pour même user+platform : mettre à jour last_used_at
- Nettoyage des tokens invalides (FCM renvoie NotRegistered sur envoi)
```

### 6.3 Événements déclencheurs et payloads

```typescript
// Nouvelle connexion
pushPayload("new_login", {
  title: "Nouvelle connexion",
  body: `Connexion depuis ${city} le ${date}`,
  icon: "/icons/security.png",
  badge: "/icons/badge.png",
  data: { type: "security", action: "review_sessions" },
  priority: "high"
});

// Code OTP envoyé
pushPayload("otp_sent", {
  title: "Code de vérification envoyé",
  body: "Vérifiez votre email. Valide 10 minutes.",
  data: { type: "auth" },
  priority: "high",
  ttl: 600  // expire en même temps que l'OTP
});

// Changement de mot de passe
pushPayload("password_changed", {
  title: "Mot de passe modifié",
  body: "Si ce n'est pas vous, contactez-nous immédiatement.",
  data: { type: "security", action: "contact_support" },
  priority: "high"
});

// Confirmation RDV
pushPayload("rdv_confirmed", {
  title: "Rendez-vous confirmé",
  body: `${service} le ${date} à ${heure}`,
  data: { type: "appointment", rdvId },
  priority: "normal"
});
```

### 6.4 Gestion des tokens invalides (token cleanup)

```typescript
// Après chaque envoi FCM, traiter les erreurs :
for (const result of sendResponse.responses) {
  if (!result.success) {
    const error = result.error.code;
    if (["messaging/registration-token-not-registered",
         "messaging/invalid-registration-token"].includes(error)) {
      // Désactiver le token en base
      await db.pushToken.update({
        where: { token: failedToken },
        data: { isActive: false }
      });
    }
  }
}
```

### 6.5 Service Worker — Web Push (PWA)

```javascript
// frontend/public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/badge-72.png',
      data: data.data,
      requireInteraction: data.priority === 'high',
      tag: data.data?.type || 'default',  // regroupement par type
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.notification.data?.action;
  if (action) {
    event.waitUntil(clients.openWindow(`/${action}`));
  }
});
```

---

## 7. STRATÉGIE DE PACKAGING MULTI-PLATEFORME

### 7.1 PWA — Configuration manifeste et Service Worker

```json
// frontend/public/manifest.json
{
  "name": "Salon de Coiffure",
  "short_name": "Salon",
  "description": "Gérez vos rendez-vous de coiffure",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#ffffff",
  "theme_color": "#C4A882",
  "icons": [
    { "src": "/icons/icon-72.png",   "sizes": "72x72",   "type": "image/png" },
    { "src": "/icons/icon-96.png",   "sizes": "96x96",   "type": "image/png" },
    { "src": "/icons/icon-128.png",  "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144.png",  "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-192.png",  "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png",  "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "screenshots": [
    { "src": "/screenshots/home.png", "sizes": "390x844", "type": "image/png", "form_factor": "narrow" }
  ],
  "categories": ["lifestyle", "health"],
  "lang": "fr"
}
```

**Stratégie de cache Service Worker :**
- Shell de l'application : cache first (mise à jour en background)
- API calls : network first avec fallback cache (données fraîches prioritaires)
- Assets statiques : stale while revalidate
- Pages offline : `/offline.html` pré-cachée

### 7.2 Desktop — Tauri

**Structure du projet Tauri :**
```
desktop/
├── src-tauri/
│   ├── Cargo.toml              → Dépendances Rust
│   ├── tauri.conf.json         → Configuration Tauri
│   │   ├── app.windows         → Taille fenêtre, titre, icône
│   │   ├── bundle.identifier   → com.salon-beaute.app
│   │   ├── bundle.targets      → ["msi", "nsis"]  (Windows)
│   │   │                       → ["dmg", "macos"]  (Mac)
│   │   └── bundle.signingIdentity → (Mac: Developer ID)
│   ├── icons/                  → Icônes 32x32 → 512x512
│   └── src/
│       └── main.rs             → Point d'entrée Rust (minimal)
└── package.json                → Scripts de build Tauri
```

**Configuration sécurité Tauri (tauri.conf.json) :**
```json
{
  "security": {
    "csp": "default-src 'self'; connect-src 'self' https://api.salon-beaute.fr https://fcm.googleapis.com",
    "dangerousDisableAssetCspModification": false
  },
  "allowlist": {
    "notification": { "all": true },
    "shell": { "all": false },
    "fs": { "all": false }
  }
}
```

**Process de build par OS :**

| OS | Commande | Artefact | Signature |
|---|---|---|---|
| Windows x64 | `tauri build` | `.msi` + `.exe` NSIS | Certificat EV Code Signing (DigiCert) |
| macOS Universal | `tauri build --target universal-apple-darwin` | `.dmg` + `.app` | Apple Developer ID + Notarisation |
| Linux x64 | `tauri build` | `.deb` + `.AppImage` | GPG signature |

### 7.3 Mobile — Capacitor

**Structure du projet Capacitor :**
```
mobile/
├── android/                    → Projet Android natif généré
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml → Permissions, deep links
│   │   └── res/               → Icônes adaptatives, splash screen
│   └── app/build.gradle       → SDK versions, signing config
├── ios/                        → Projet iOS natif généré (Xcode)
│   ├── App/
│   │   ├── Info.plist         → Permissions, bundle ID, URL schemes
│   │   └── Assets.xcassets   → Icônes, splash screen
│   └── Podfile                → Dépendances CocoaPods
├── capacitor.config.ts         → Configuration principale
└── package.json
```

**capacitor.config.ts :**
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.salon-beaute.app',
  appName: 'Salon de Coiffure',
  webDir: '../frontend/out',  // Export Next.js statique
  server: {
    androidScheme: 'https',
    cleartext: false  // HTTPS uniquement
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      androidScaleType: "CENTER_CROP"
    }
  }
};
```

**Processus de publication :**

| Plateforme | Build | Test | Publication |
|---|---|---|---|
| Android | `npx cap build android` → `.aab` | Firebase Test Lab | Google Play Console → review 2–3 jours |
| iOS | `npx cap build ios` → Xcode Archive → `.ipa` | TestFlight | App Store Connect → review 1–7 jours |

### 7.4 Partage de code — Architecture monorepo

```
salon-coiffure-app/
├── frontend/          → Next.js (Web + export statique pour Capacitor)
├── backend/           → Express.js API
├── desktop/           → Configuration Tauri uniquement (pas de JS)
├── mobile/            → Configuration Capacitor uniquement
├── shared/            → Types TypeScript partagés (pas de dépendances circulaires)
│   ├── types/         → DTOs, interfaces communes
│   └── validators/    → Zod schemas (réutilisés frontend + backend)
└── e2e-tests/         → Tests Playwright
```

---

## 8. SÉCURITÉ APPLICATIVE — COUCHES DE PROTECTION

### 8.1 Cryptographie et hashage

| Donnée | Algorithme | Paramètres |
|---|---|---|
| Mots de passe | Argon2id | memoryCost=65536, timeCost=3, parallelism=4 |
| Codes OTP | bcrypt | cost=10 (équivalent NIST pour données à durée de vie courte) |
| Tokens refresh | SHA-256 (HMAC) | Stocké hashé en base, jamais en clair |
| Secrets TOTP | AES-256-GCM | Clé de chiffrement via variable d'environnement |
| Emails en base | Pas de hashage | Email en clair nécessaire pour envoi — chiffrer uniquement si exigé RGPD strict |

**Pourquoi Argon2id plutôt que bcrypt ?**
- Argon2id résiste aux attaques GPU et ASIC (utilise la mémoire = cher à paralléliser)
- bcrypt est limité à 72 caractères d'input
- NIST SP 800-63B recommande explicitement Argon2 depuis 2022

### 8.2 JWT — Configuration RS256

```typescript
// Access token : 15 minutes
{
  userId, email, role, sessionId, mfaVerified,
  deviceFingerprint, pv,  // password version (invalidation si changement mdp)
  iss: "salon-beaute-api",
  aud: "salon-beaute-frontend",
  exp: now + 900
}

// Refresh token : 7 jours (30 jours "Remember Me")
// Stocké en httpOnly cookie, hash en base
// Rotation : nouveau refresh à chaque utilisation (invalidation de l'ancien)
```

### 8.3 Content Security Policy (CSP) — Backend

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://fcm.googleapis.com https://api.resend.com;
  font-src 'self' https:;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
  form-action 'self';
  upgrade-insecure-requests;
```

### 8.4 Rate Limiting — Configuration Redis

```typescript
// Stratégie : sliding window log (Redis Sorted Set)
const rateLimits = {
  "POST /api/auth/request-otp":        { max: 1,  window: 60     },  // 1/minute
  "POST /api/auth/verify-otp":         { max: 3,  window: 900    },  // 3/15min
  "POST /api/auth/login":              { max: 5,  window: 900    },  // 5/15min
  "POST /api/auth/complete-reg":       { max: 3,  window: 3600   },  // 3/heure
  "POST /api/auth/password-reset":     { max: 3,  window: 3600   },  // 3/heure
  "global":                            { max: 100, window: 60    },  // 100/minute global
};
```

### 8.5 Validation des entrées — Zod

```typescript
// Schéma inscription
const RegisterEmailSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim()
});

const OtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d{6}$/)
});

const PasswordSchema = z.object({
  password: z.string()
    .min(12, "12 caractères minimum")
    .regex(/[A-Z]/, "Une majuscule requise")
    .regex(/[a-z]/, "Une minuscule requise")
    .regex(/[0-9]/, "Un chiffre requis")
    .regex(/[^A-Za-z0-9]/, "Un caractère spécial requis"),
  confirmPassword: z.string()
}).refine(d => d.password === d.confirmPassword, "Les mots de passe ne correspondent pas");
```

### 8.6 Protection CSRF

- Tokens CSRF via double-submit cookie pattern (déjà implémenté en production)
- SameSite=Lax sur tous les cookies en développement
- SameSite=Strict en production pour les cookies d'authentification

### 8.7 Détection d'anomalies

```typescript
// Détection connexion suspecte
async function detectSuspiciousLogin(user: User, req: Request): Promise<boolean> {
  const userAgent = req.headers["user-agent"];
  const ip = getClientIp(req);
  const geoLocation = await geoIpLookup(ip);  // via MaxMind GeoLite2

  // Récupérer les 5 dernières connexions
  const recentLogins = await getRecentAuditLogs(user.id, "LOGIN_SUCCESS", 5);

  // Critères de suspicion :
  // - IP d'un pays différent des habitudes
  // - User-Agent jamais vu
  // - Heure inhabituelle (ex: 3h du matin locale)
  // → Si suspicion : notification push + email de sécurité
  //   mais NE PAS bloquer (trop de faux positifs)
}
```

---

## 9. CONFORMITÉ RGPD

### 9.1 Données personnelles collectées et base légale

| Donnée | Finalité | Base légale | Durée de conservation |
|---|---|---|---|
| Email | Identification, notifications | Contrat | Durée du compte + 3 ans |
| Nom, prénom | Identification client | Contrat | Durée du compte + 3 ans |
| Téléphone | Contact, rappels RDV | Contrat | Durée du compte + 3 ans |
| Historique RDV | Suivi commercial | Intérêt légitime | 5 ans |
| Adresse IP (logs) | Sécurité, audit | Intérêt légitime | 12 mois |
| Token push | Notifications | Consentement | Jusqu'au retrait |
| Logs email | Preuve d'envoi, support | Intérêt légitime | 12 mois |

### 9.2 Droits des utilisateurs — Implémentation technique

```
ENDPOINT : DELETE /api/user/account  → Droit à l'effacement
  → Anonymisation des données personnelles (pas suppression physique pour intégrité référentielle)
  → email → "deleted_{hash}@deleted.invalid"
  → nom, prénom → "Compte" "Supprimé"
  → tokens push → suppression physique
  → refresh tokens → suppression physique

ENDPOINT : GET /api/user/export  → Droit à la portabilité
  → Export JSON de toutes les données personnelles
  → Format standard, lisible par machine

ENDPOINT : PUT /api/user/consents  → Gestion des consentements
  → Consentement notifications push : révocable à tout moment
  → Consentement emails marketing : distinct des emails transactionnels
```

### 9.3 Logs d'audit immuables

Les `AuditLog` ne doivent jamais être modifiés ou supprimés (même lors d'une demande RGPD). Ils sont anonymisés (userId → NULL) si l'utilisateur exerce son droit à l'effacement, mais les entrées sont conservées.

---

## 10. PLAN DE DÉPLOIEMENT ET CI/CD

### 10.1 Environnements

| Env | URL | Base de données | Redis | Emails |
|---|---|---|---|---|
| dev | localhost:3000 | PostgreSQL local | Redis local | Resend sandbox (pas de vrai envoi) |
| staging | staging.salon-beaute.fr | PostgreSQL dédié | Redis Cloud | Resend production (domaine test) |
| production | salon-beaute.fr | PostgreSQL HA | Redis Cluster | Resend production (domaine réel) |

### 10.2 Pipeline CI/CD (GitHub Actions)

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]

jobs:
  quality:
    - TypeScript strict check (tsc --noEmit)
    - ESLint + Prettier
    - Zod schema validation tests
    - Audit npm (npm audit --audit-level=high)

  test:
    - Backend : Jest unit tests (auth service, email service, push service)
    - Backend : Integration tests (API endpoints avec DB test)
    - Frontend : Vitest component tests
    - E2E : Playwright (suite complète sur environnement staging)

  security:
    - OWASP Dependency Check
    - Snyk scan (vulnérabilités connues)
    - Semgrep (SAST — détection patterns vulnérables)

  build:
    - Docker image backend
    - Next.js build + export
    - Tauri build (Windows + Mac via GitHub-hosted runners)
    - Capacitor build (Android via ubuntu-latest)

  deploy:
    - Staging : déploiement automatique sur merge vers `develop`
    - Production : déploiement manuel déclenché sur tag `v*`
```

### 10.3 Monitoring et alerting

```
Services de monitoring :
├── Sentry          → Erreurs frontend et backend (JavaScript + TypeScript)
├── Uptime Robot    → Healthcheck /health toutes les 60 secondes
├── Resend Dashboard → Taux de délivrabilité, bounces
└── FCM Console     → Statistiques push, taux de livraison

Alertes Sentry configurées :
├── Taux d'erreur 5xx > 5%/heure → alerte immédiate
├── Temps de réponse API > 500ms (p95) → alerte
├── Échec d'envoi email > 10%/heure → alerte
└── Token push invalide > 20% → alerte (tokens à nettoyer)
```

---

## 11. ESTIMATION DES COÛTS MENSUELS

### 11.1 Infrastructure

| Service | Plan | Coût mensuel estimé |
|---|---|---|
| Hébergement backend (VPS) | 2 vCPU, 4 Go RAM | ~15–25 € |
| PostgreSQL (managed) | Starter 1 Go | ~10–15 € |
| Redis Cloud | 250 Mo | Gratuit → ~7 € (si plus) |
| CDN + certificat TLS | Cloudflare Free | Gratuit |
| Domaine | salon-beaute.fr | ~12 €/an → ~1 €/mois |

### 11.2 Services tiers

| Service | Plan | Coût mensuel estimé |
|---|---|---|
| Resend (emails) | Gratuit jusqu'à 3 000/mois | 0 € → 20 $ (Pro) |
| Firebase FCM (push) | Spark (gratuit) | 0 € |
| GitHub Actions | 2 000 min/mois gratuit | 0 € → ~4 $ |
| Sentry | Developer (gratuit) | 0 € → 26 $ (Team) |
| Apple Developer | Requis pour iOS | 99 $/an → ~8,25 €/mois |
| Google Play | One-time | 25 $ unique |
| Certificate EV (Tauri Windows) | DigiCert | ~200–400 $/an → ~25 €/mois |

### 11.3 Total estimé

| Phase | Coût mensuel |
|---|---|
| Démarrage (dev/staging) | ~30–40 € |
| Production petite scale (< 500 utilisateurs) | ~60–90 € |
| Production moyenne scale (< 5 000 utilisateurs) | ~120–180 € |

---

## 12. PHASES D'IMPLÉMENTATION

### Phase 1 — Système Email (Priorité : CRITIQUE)
**Durée estimée : 3–4 jours**
- [ ] Installation et configuration Resend SDK
- [ ] Configuration DNS (SPF, DKIM, DMARC)
- [ ] Service `emailService.ts` avec queue Redis
- [ ] Templates React Email (OTP, welcome, security-alert, password-reset)
- [ ] Table `email_logs` + webhook Resend
- [ ] Tests unitaires email service
- [ ] Tests E2E : vérifier réception email (via API Resend sandbox)

### Phase 2 — Authentification OTP (Priorité : CRITIQUE)
**Durée estimée : 4–5 jours**
- [ ] Endpoints : `POST /auth/request-otp`, `POST /auth/verify-otp`, `POST /auth/complete-registration`
- [ ] Migration Prisma : colonnes `emailVerified`, `emailVerifiedAt` sur `users`
- [ ] Rate limiting Redis sur les endpoints OTP
- [ ] Remplacement bcrypt → Argon2id pour les mots de passe
- [ ] Frontend : formulaire en 3 étapes (email → OTP → mot de passe)
- [ ] Tests unitaires backend (auth service)
- [ ] Tests E2E : flow complet inscription

### Phase 3 — Notifications Push (Priorité : HAUTE)
**Durée estimée : 3–4 jours**
- [ ] Configuration Firebase project + Admin SDK
- [ ] Table `push_notification_tokens` + `notification_logs`
- [ ] Service `pushService.ts`
- [ ] Endpoint `POST /push/register-token`
- [ ] Service Worker frontend (web push)
- [ ] Intégration Capacitor Push Notifications (mobile)
- [ ] Intégration Tauri notifications (desktop)
- [ ] Tests : envoi push sur chaque plateforme

### Phase 4 — PWA + Multi-plateforme (Priorité : MOYENNE)
**Durée estimée : 5–7 jours**
- [ ] Manifeste PWA + Service Worker complet
- [ ] Configuration Tauri (Windows + Mac)
- [ ] Pipeline build Tauri (GitHub Actions)
- [ ] Configuration Capacitor Android
- [ ] Configuration Capacitor iOS
- [ ] Pipeline build Capacitor (GitHub Actions)
- [ ] Tests sur chaque plateforme cible
- [ ] Documentation déploiement stores

---

## ANNEXE A — VARIABLES D'ENVIRONNEMENT REQUISES

```env
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM="Salon de Coiffure <noreply@salon-beaute.fr>"
EMAIL_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Firebase (Push)
FIREBASE_PROJECT_ID=salon-beaute-xxxxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@salon-beaute-xxxxx.iam.gserviceaccount.com

# Argon2id
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3

# OTP (durées)
OTP_TTL_SECONDS=600
OTP_MAX_ATTEMPTS=3
OTP_RATE_LIMIT_SECONDS=60

# OTP token
OTP_JWT_AUDIENCE=otp-completion
```

---

## ANNEXE B — DÉCISIONS ARCHITECTURALES CLÉS (ADR)

**ADR-001 : OTP stocké en Redis, pas en PostgreSQL**
- Décision : Redis avec TTL natif
- Raison : Expiration atomique, pas de cleanup job, performance O(1)
- Alternative rejetée : PostgreSQL avec cron de nettoyage (risque de codes expirés non supprimés)

**ADR-002 : Argon2id plutôt que bcrypt**
- Décision : Argon2id pour tous les nouveaux mots de passe
- Raison : Résistance GPU/ASIC, recommandation NIST 2022
- Migration : bcrypt existant conservé, rehash transparent à la prochaine connexion

**ADR-003 : Resend plutôt qu'AWS SES**
- Décision : Resend en phase de démarrage
- Raison : DX supérieure, gratuit jusqu'à 3 000/mois, React Email natif
- Plan de migration : Si volumétrie > 50 000 emails/mois → SES (4,40x moins cher à grande échelle)

**ADR-004 : Tauri pour desktop, pas Electron**
- Décision : Tauri v2
- Raison : Binaire 10× plus petit, mémoire 10× inférieure, sécurité Rust
- Contrainte : Require Rust toolchain dans le CI (temps de build plus long)

**ADR-005 : Capacitor pour mobile, pas React Native**
- Décision : Capacitor v6
- Raison : Zéro réécriture de code UI, partage 100% du code React existant
- Contrainte : Performance légèrement inférieure à React Native pour animations complexes (non applicable ici)

---

*Document soumis à validation. Aucune ligne de code ne sera écrite avant approbation explicite.*
