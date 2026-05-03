# =========================================
# SALON DE COIFFURE - COMMANDES RAPIDES
# =========================================

# ⭐ DÉMARRAGE COMPLET (Recommandé en 1er lancement)
# Étapes:
# 1. Ouvrez PowerShell en tant qu'administrateur
# 2. Lancez cette commande:

docker-compose up -d postgres; `
Start-Sleep -Seconds 5; `
Set-Location backend; `
npm install; `
npm run db:generate; `
npm run db:push; `
npm run db:seed; `
Write-Host "`n✅ Backend configuré! Tapez: npm run dev" -ForegroundColor Green; `
pause


# =========================================
# DÉMARRAGE DU BACKEND (Après 1ère config)
# =========================================
Set-Location backend
npm run dev


# =========================================
# DÉMARRAGE DU FRONTEND (Dans un terminal)
# =========================================
Set-Location frontend
npm install  # Une fois seulement
npm run dev


# =========================================
# GESTION DE LA BASE DE DONNÉES
# =========================================

# Démarrer PostgreSQL
docker-compose up -d postgres

# Arrêter PostgreSQL
docker-compose down

# Voir les logs PostgreSQL
docker logs salon-postgres

# Ouvrir Prisma Studio (graphique)
Set-Location backend
npm run db:studio

# Vérifier que la DB est prête
Invoke-WebRequest http://localhost:3001/health


# =========================================
# MIGRER LE SCHEMA PRISMA
# =========================================
# Après avoir modifié backend/prisma/schema.prisma:

Set-Location backend
npm run db:migrate       # Créer une migration nommée
# ou
npm run db:push         # Synchroniser sans nommer la migration


# =========================================
# NETTOYAGE & RESET COMPLET
# =========================================

# Supprimer les installations et fichiers
Remove-Item -Recurse -Force backend/node_modules, frontend/node_modules -ErrorAction SilentlyContinue
Remove-Item -Force backend/.env, frontend/.env.local -ErrorAction SilentlyContinue

# Arrêter et supprimer tous les conteneurs Docker
docker-compose down -v

# Relancer depuis zéro
docker-compose up -d postgres
Start-Sleep -Seconds 10
Set-Location backend
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev


# =========================================
# VÉRIFICATIONS & DIAGNOSTICS
# =========================================

# Vérifier les services en cours d'exécution
netstat -ano | grep :3001  # Backend
netstat -ano | grep :3000  # Frontend
netstat -ano | grep :5434  # PostgreSQL

# Voir les processus Node.js
Get-Process node

# Arrêter un processus Node specific (par port)
# Remplacez 3001 par le port souhaité
$processId = (Get-NetTCPConnection -LocalPort 3001).OwningProcess
Stop-Process -Id $processId -Force

# Tester la connexion API
Invoke-WebRequest http://localhost:3001/health

# Tester la connexion Frontend
Invoke-WebRequest http://localhost:3000


# =========================================
# VARIABLES D'ENVIRONNEMENT IMPORTANTES
# =========================================
# Backend (.env):
# DATABASE_URL=postgresql://postgres:postgres@localhost:5434/salon_db
# PORT=3001
# JWT_SECRET=dev_jwt_secret_salon_coiffure_2025_minimum_32_chars
# FRONTEND_URL=http://localhost:3000

# Frontend (.env.local):
# NEXT_PUBLIC_API_URL=http://localhost:3001/api


# =========================================
# ACCÈS AUX SERVICES
# =========================================
# Application Frontend: http://localhost:3000
# API Backend:         http://localhost:3001
# Health Check:        http://localhost:3001/health
# Prisma Studio:       npm run db:studio (dans backend/)


Write-Host "`n✅ Aide affichée! Consultez le README pour plus d'infos" -ForegroundColor Green
