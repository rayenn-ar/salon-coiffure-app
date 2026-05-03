# ================================================================
# SALON DE COIFFURE - Script de démarrage complet et robuste
# ================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "     SALON DE COIFFURE - Demarrage de l'application" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Se placer dans le bon répertoire
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# ===== ETAPE 1: Vérifier Docker =====
Write-Host "[1/6] Verification de Docker..." -ForegroundColor Yellow
try {
    docker --version 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Docker non trouve" }
    Write-Host "      OK - Docker est installe" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERREUR: Docker n'est pas installe ou n'est pas en cours d'execution" -ForegroundColor Red
    Write-Host "Installez Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

# ===== ETAPE 2: Démarrer PostgreSQL =====
Write-Host "[2/6] Demarrage de PostgreSQL..." -ForegroundColor Yellow

$postgresRunning = docker ps --format "{{.Names}}" | Select-String "salon-postgres"
if ($postgresRunning) {
    Write-Host "      PostgreSQL est deja en cours d'execution" -ForegroundColor Green
} else {
    Write-Host "      Lancement de PostgreSQL..."
    docker-compose up -d postgres 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      ERREUR lors du demarrage de PostgreSQL" -ForegroundColor Red
        Read-Host "Appuyez sur Entree pour quitter"
        exit 1
    }
    Write-Host "      Attente de l'initialisation de PostgreSQL (10 secondes)..."
    Start-Sleep -Seconds 10
    Write-Host "      OK - PostgreSQL demarre" -ForegroundColor Green
}

# ===== ETAPE 3: Configuration Backend =====
Write-Host "[3/6] Configuration du Backend..." -ForegroundColor Yellow
Set-Location backend

# Vérifier si node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "      Installation des dependances npm (cela peut prendre 1-2 minutes)..."
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      ERREUR lors de npm install" -ForegroundColor Red
        Set-Location ..
        Read-Host "Appuyez sur Entree pour quitter"
        exit 1
    }
}

# Générer Prisma Client
Write-Host "      Generation du client Prisma..."
npm run db:generate 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "      AVERTISSEMENT lors de db:generate" -ForegroundColor Yellow
}

# Synchroniser la base de données
Write-Host "      Synchronisation de la base de donnees..."
npm run db:push 2>&1 | Out-Null

# Seeding
Write-Host "      Seeding de la base de donnees..."
npm run db:seed 2>&1 | Out-Null

Write-Host "      OK - Backend configure" -ForegroundColor Green
Set-Location ..

# ===== ETAPE 4: Configuration Frontend =====
Write-Host "[4/6] Configuration du Frontend..." -ForegroundColor Yellow
Set-Location frontend

# Vérifier si node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "      Installation des dependances npm (cela peut prendre 1-2 minutes)..."
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      ERREUR lors de npm install frontend" -ForegroundColor Red
        Set-Location ..
        Read-Host "Appuyez sur Entree pour quitter"
        exit 1
    }
}

Write-Host "      OK - Frontend configure" -ForegroundColor Green
Set-Location ..

# ===== ETAPE 5: Lancer les services =====
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "     Configuration terminee - Lancement des services..." -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[5/6] Lancement du Backend (port 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir\backend'; Write-Host 'BACKEND API - Port 3001' -ForegroundColor Green; npm run dev"
Start-Sleep -Seconds 3

Write-Host "[6/6] Lancement du Frontend (port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir\frontend'; Write-Host 'FRONTEND WEB - Port 3000' -ForegroundColor Green; npm run dev"
Start-Sleep -Seconds 5

# ===== Ouvrir le navigateur =====
Write-Host "      Ouverture du navigateur..."
Start-Process "http://localhost:3000"

# ===== Affichage final =====
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "          LANCEMENT TERMINE AVEC SUCCES!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "L'APPLICATION EST MAINTENANT EN COURS D'EXECUTION:" -ForegroundColor White
Write-Host ""
Write-Host "   Frontend:        http://localhost:3000" -ForegroundColor Cyan
Write-Host "   API Backend:     http://localhost:3001" -ForegroundColor Cyan
Write-Host "   Health Check:    http://localhost:3001/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "BASE DE DONNEES:" -ForegroundColor White
Write-Host "   PostgreSQL 16 sur localhost:5434" -ForegroundColor Cyan
Write-Host "   Database: salon_db" -ForegroundColor Cyan
Write-Host ""
Write-Host "COMPTES DE TEST:" -ForegroundColor White
Write-Host "   Admin:     admin@salon-beaute.fr / admin12345" -ForegroundColor Yellow
Write-Host "   Coiffeuse: fatima@salon-beaute.fr / coiffeuse123" -ForegroundColor Yellow
Write-Host "   Cliente:   test@cliente.fr / cliente123" -ForegroundColor Yellow
Write-Host ""
Write-Host "WINDOWS OUVERTES:" -ForegroundColor White
Write-Host "   - Terminal Backend  (Express API)" -ForegroundColor Gray
Write-Host "   - Terminal Frontend (Next.js)" -ForegroundColor Gray
Write-Host "   - Navigateur web" -ForegroundColor Gray
Write-Host ""
Write-Host "POUR ARRETER L'APPLICATION:" -ForegroundColor White
Write-Host "   1. Fermez les deux terminaux Backend et Frontend" -ForegroundColor Gray
Write-Host "   2. Ou tapez Ctrl+C dans chaque terminal" -ForegroundColor Gray
Write-Host "   3. Pour arreter PostgreSQL: docker-compose down" -ForegroundColor Gray
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""

Read-Host "Appuyez sur Entree pour fermer cette fenetre"
