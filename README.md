# 🎨 SALON DE COIFFURE - Application Web

> Application de gestion de salon de coiffure avec réservations en ligne, gestion des coiffeuses et services.

---

## 🚀 DÉMARRAGE RAPIDE

### **Option A: Démarrage Complet Automatisé (Recommandé)**

Double-cliquez sur:
```
START-FULL.bat
```

Cela fera:
1. ✅ Démarrer PostgreSQL
2. ✅ Installer les dépendances
3. ✅ Configurer la base de données
4. ✅ Lancer le backend (port 3001)
5. ✅ Lancer le frontend (port 3000)
6. ✅ Ouvrir automatiquement le site web

---

### **Option B: Démarrage Semi-Automatisé**

1. Double-cliquez sur `RUN.bat`
2. Suivez les instructions affichées
3. Ouvrez deux terminaux et lancez les commandes proposées

---

### **Option C: Démarrage Manuel (Plus de contrôle)**

#### Terminal 1 - PostgreSQL:
```bash
docker-compose up -d postgres
```

#### Terminal 2 - Backend:
```bash
cd backend
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

#### Terminal 3 - Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## 📍 ACCÈS À L'APPLICATION

| Service | URL |
|---------|-----|
| 🌐 **Application Web** | http://localhost:3000 |
| 🔌 **API Backend** | http://localhost:3001 |
| ✅ **Health Check API** | http://localhost:3001/health |
| 📊 **Prisma Studio (DB)** | `npm run db:studio` (dans `backend/`) |

---

## 💾 BASE DE DONNÉES

La base de données PostgreSQL 16 démarre automatiquement en Docker:

```
Host:     localhost
Port:     5434
User:     postgres
Password: postgres
Database: salon_db
```

### Commandes PostgreSQL utiles:

```bash
# Voir la base de données graphiquement
cd backend
npm run db:studio

# Accès direct via psql (si installé)
psql -h localhost -p 5434 -U postgres -d salon_db

# Voir les logs PostgreSQL
docker logs salon-postgres

# Arrêter PostgreSQL
docker-compose down
```

---

## 🏗️ ARCHITECTURE

```
salon-coiffure-app/
│
├── backend/                    # API Express + Prisma
│   ├── src/
│   │   ├── app.ts             (Point d'entrée)
│   │   ├── routes/            (Routes API)
│   │   ├── controllers/       (Logique métier)
│   │   ├── middleware/        (Auth, Erreurs, etc)
│   │   └── config/            (Base de données)
│   ├── prisma/
│   │   └── schema.prisma      (Modèle de données)
│   ├── package.json
│   └── .env                   (Variables d'environnement)
│
├── frontend/                   # App Next.js
│   ├── src/app/               (Pages)
│   │   ├── page.tsx           (Accueil)
│   │   ├── connexion/         (Login)
│   │   ├── inscription/       (Signup)
│   │   ├── reservation/       (Réservations)
│   │   ├── services/          (Services)
│   │   └── ...
│   ├── src/components/        (Composants réutilisables)
│   ├── package.json
│   └── .env.local             (API URL)
│
├── docker-compose.yml         (PostgreSQL)
├── START-FULL.bat            (Démarrage complet automatisé)
├── RUN.bat                   (Démarrage semi-automatisé)
├── STARTUP_GUIDE.md          (Guide détaillé)
└── package.json              (Scripts racine)
```

---

## 🛠️ TECHNOLOGIES

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **Prisma** - ORM (Object-Relational Mapping)
- **PostgreSQL** - Base de données
- **JWT** - Authentification
- **TypeScript** - Typage statique

### Frontend
- **Next.js** - Framework React avec SSR
- **React 19** - Interface utilisateur
- **TypeScript** - Typage statique
- **Tailwind CSS** - Styling
- **TanStack React Query** - Gestion des données
- **Zustand** - State management
- **Axios** - Requêtes HTTP

---

## 🔐 AUTHENTIFICATION

L'application utilise JWT (JSON Web Tokens) pour l'authentification:

- `JWT_SECRET` dans `backend/.env` (à changer en production!)
- Les tokens expirent après 7 jours
- Les mots de passe sont hashés avec bcrypt

---

## 📚 COMMANDES UTILES

### Racine du projet:
```bash
# Scripts raccourcis disponibles dans package.json
npm run dev:full           # Démarrage complet
npm run db:start           # Démarrer PostgreSQL
npm run db:stop            # Arrêter PostgreSQL
npm run backend:dev        # Démarrer backend seulement
npm run frontend:dev       # Démarrer frontend seulement
npm run clean              # Nettoyer node_modules
npm run reset              # Reset complet
```

### Backend:
```bash
cd backend

npm run dev                # Mode développement
npm run build              # Build production
npm run start              # Mode production

# Base de données
npm run db:generate        # Générer Prisma Client
npm run db:push            # Synchroniser schema
npm run db:migrate         # Créer migration
npm run db:studio          # Afficher DB graphiquement
npm run db:seed            # Seeder les données
```

### Frontend:
```bash
cd frontend

npm run dev                # Mode développement
npm run build              # Build production
npm run start              # Serveur production
```

---

## 🐛 TROUBLESHOOTING

### ❌ "Port 3001 already in use"
```bash
# Trouver le processus utilisant le port
netstat -ano | grep :3001

# Arrêter le processus (remplacer PID)
taskkill /PID your_pid /F
```

### ❌ "Cannot connect to database"
```bash
# Vérifier que PostgreSQL est actif
docker ps | grep salon-postgres

# Voir les logs
docker logs salon-postgres

# Redémarrer
docker-compose restart postgres
```

### ❌ "Module not found" en Backend
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npm run db:generate
```

### ❌ Frontend ne se connecte pas à l'API
- Vérifier que backend est lancé: http://localhost:3001/health
- Vérifier `NEXT_PUBLIC_API_URL` dans `frontend/.env.local`
- Vérifier CORS dans `backend/src/app.ts`

### ❌ Migrations échouées
```bash
cd backend
npm run db:push -- --force-reset  # Force reset (perte de données!)
npm run db:seed
```

---

## 🌐 DÉPLOIEMENT

Avant de déployer en **production**:

1. **Changer `JWT_SECRET`** dans `backend/.env`
2. **Utiliser une vraie base PostgreSQL gérée** (AWS RDS, Azure Database, etc)
3. **Mettre `NODE_ENV=production`**
4. **Configurer HTTPS**
5. **Mettre à jour `FRONTEND_URL`** dans backend
6. **Mettre à jour `NEXT_PUBLIC_API_URL`** dans frontend

---

## 📞 SUPPORT

Consultez les fichiers:
- `STARTUP_GUIDE.md` - Guide détaillé de démarrage
- `COMMANDES_RAPIDES.ps1` - Commandes PowerShell rapides
- `architecture_fonctionnelle.txt` - Architecture métier
- `plan technique complet.txt` - Documentation technique

---

## ✅ CHECKLIST DE DÉMARRAGE

- [ ] Docker installé et en cours d'exécution
- [ ] `docker-compose up -d postgres` lancé
- [ ] Backend npm modules installés
- [ ] `npm run db:push` exécuté dans backend
- [ ] Backend lancé sur le port 3001
- [ ] Frontend lancé sur le port 3000
- [ ] http://localhost:3000 accessible
- [ ] http://localhost:3001/health répond "OK"

---

## 🎯 PRÊT À DÉMARRER?

**Double-cliquez sur `START-FULL.bat`** et laissez l'application se lancer! 🚀

