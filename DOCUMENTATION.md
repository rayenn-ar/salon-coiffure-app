# Salon de Coiffure – Documentation Complète

## Présentation
Application web de gestion de salon de coiffure : prise de rendez-vous en ligne, gestion des coiffeuses, services, espace admin, sécurité avancée (MFA, JWT), base de données PostgreSQL, frontend Next.js/React.

---

## Architecture

- **Monorepo**
  - `backend/` : API Express.js + Prisma ORM (TypeScript)
  - `frontend/` : Next.js (React, TypeScript)
  - `e2e-tests/` : Playwright (tests bout-en-bout)
  - `docker-compose.yml` : Orchestration PostgreSQL/Redis

---

## Backend

- **Node.js/Express**
- **Prisma ORM** (PostgreSQL)
- **Sécurité** : JWT, Argon2id/Bcrypt, MFA, CORS, Rate Limiting, CSRF
- **Structure**
  - `src/controllers/` : Logique métier (auth, admin, cliente, coiffeuse, services...)
  - `src/routes/` : Définition des routes REST
  - `src/middleware/` : Auth, erreurs, rate limit, CSRF
  - `src/config/` : Connexions DB, Redis, chiffrement
  - `src/utils/` : Fonctions utilitaires (JWT, audit, réponses...)
  - `prisma/schema.prisma` : Modèle de données
  - `prisma/seed.ts` : Données de base (admin, coiffeuses...)
- **Démarrage**
  - `npm run dev` (dev)
  - `npm run build && npm start` (prod)
  - `npm run db:push` (création tables)
  - `npm run db:seed` (données de base)

---

## Frontend

- **Next.js** (React, TypeScript)
- **Pages**
  - `/` : Accueil
  - `/connexion` : Login
  - `/inscription` : Création de compte
  - `/reservation` : Prise de rendez-vous
  - `/services` : Liste des prestations
  - `/admin` : Espace admin sécurisé (MFA)
  - `/coiffeuses` : Présentation équipe
- **Composants**
  - `src/components/` : UI réutilisable
  - `src/lib/` : Fonctions utilitaires
- **Sécurité**
  - Authentification JWT (cookies sécurisés)
  - Gestion des rôles (admin, coiffeuse, cliente)

---

## Base de Données

- **PostgreSQL 16** (via Docker)
- **Tables principales**
  - `users` (hérite admin/coiffeuse/cliente)
  - `admins`, `coiffeuses`, `clientes`
  - `services`, `rendezvous`, `avis`, etc.
- **Gestion migrations**
  - Prisma (`db:push`, `db:migrate`)
- **Seeding**
  - Admin par défaut : admin@salon-beaute.fr / admin12345

---

## Sécurité

- **MFA** (TOTP, WebAuthn, Email)
- **Rate Limiting** (Redis)
- **CSRF** (production)
- **CORS** (origines contrôlées)
- **Audit Log** (toutes actions sensibles)
- **Hashage** : Argon2id (nouveaux comptes), Bcrypt (migration)

---

## Tests

- **E2E** : Playwright (`e2e-tests/`)
- **Backend** : Tests unitaires (à compléter)
- **CI/CD** : (à intégrer)

---

## Démarrage rapide

1. Lancer Docker Desktop
2. `cd salon-coiffure-app`
3. Double-cliquer sur `DEMARRER.bat` ou `START.bat`
4. Accéder à http://localhost:3000
5. Connexion admin : admin@salon-beaute.fr / admin12345

---

## Dépannage

- **Erreur 500 login** : Vérifier la connexion à la base (port, user, mot de passe, tables créées)
- **Ports** : Backend 3001, Frontend 3000, PostgreSQL 5434, Redis 6379
- **Docker** : `docker ps`, `docker logs salon-postgres`
- **Prisma** : `npm run db:push`, `npm run db:seed`

---

## Bonnes pratiques

- Toujours utiliser MFA pour les admins
- Ne jamais exposer JWT_SECRET en production
- Séparer les rôles et droits d’accès
- Logger toutes les actions critiques
- Optimiser les requêtes Prisma
- Écrire des tests pour chaque endpoint critique

---

## Pour aller plus loin

- Ajouter des tests unitaires backend
- CI/CD (GitHub Actions, Azure DevOps...)
- Monitoring (Sentry, Datadog...)
- RGPD : gestion consentement, anonymisation
- Déploiement cloud (Azure, AWS, GCP)

---

## Contacts

- Support : contact@salon-beaute.fr
- Documentation technique : voir README.md, STARTUP_GUIDE.md
