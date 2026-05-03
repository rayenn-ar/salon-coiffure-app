# ================================================================
# SCRIPT DE DIAGNOSTIC - Vérifie l'état de tous les services
# ================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "     DIAGNOSTIC DE L'APPLICATION SALON DE COIFFURE" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$allOK = $true

# Vérifier Docker
Write-Host "1. Docker:" -ForegroundColor Yellow -NoNewline
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
        Write-Host "   Version: $dockerVersion" -ForegroundColor Gray
    } else {
        Write-Host " ERREUR" -ForegroundColor Red
        $allOK = $false
    }
} catch {
    Write-Host " ERREUR - Docker non installe" -ForegroundColor Red
    $allOK = $false
}

# Vérifier PostgreSQL
Write-Host ""
Write-Host "2. PostgreSQL (Docker):" -ForegroundColor Yellow -NoNewline
$postgresRunning = docker ps --format "{{.Names}}" | Select-String "salon-postgres"
if ($postgresRunning) {
    Write-Host " EN COURS D'EXECUTION" -ForegroundColor Green
    $postgresStatus = docker ps --filter "name=salon-postgres" --format "{{.Status}}"
    Write-Host "   Status: $postgresStatus" -ForegroundColor Gray
} else {
    Write-Host " ARRETE" -ForegroundColor Red
    Write-Host "   Solution: Executez 'docker-compose up -d postgres'" -ForegroundColor Yellow
    $allOK = $false
}

# Vérifier Backend (port 3001)
Write-Host ""
Write-Host "3. Backend API (port 3001):" -ForegroundColor Yellow -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host " OK" -ForegroundColor Green
        Write-Host "   Health check: http://localhost:3001/health" -ForegroundColor Gray
    } else {
        Write-Host " ERREUR (Status: $($response.StatusCode))" -ForegroundColor Red
        $allOK = $false
    }
} catch {
    Write-Host " NON ACCESSIBLE" -ForegroundColor Red
    Write-Host "   Solution: Demarrez avec 'cd backend && npm run dev'" -ForegroundColor Yellow
    $allOK = $false
}

# Vérifier Frontend (port 3000)
Write-Host ""
Write-Host "4. Frontend Web (port 3000):" -ForegroundColor Yellow -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host " OK" -ForegroundColor Green
        Write-Host "   URL: http://localhost:3000" -ForegroundColor Gray
    } else {
        Write-Host " ERREUR (Status: $($response.StatusCode))" -ForegroundColor Red
        $allOK = $false
    }
} catch {
    Write-Host " NON ACCESSIBLE" -ForegroundColor Red
    Write-Host "   Solution: Demarrez avec 'cd frontend && npm run dev'" -ForegroundColor Yellow
    $allOK = $false
}

# Vérifier Node.js
Write-Host ""
Write-Host "5. Node.js:" -ForegroundColor Yellow -NoNewline
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK ($nodeVersion)" -ForegroundColor Green
    } else {
        Write-Host " ERREUR" -ForegroundColor Red
        $allOK = $false
    }
} catch {
    Write-Host " NON INSTALLE" -ForegroundColor Red
    $allOK = $false
}

# Vérifier les dépendances
Write-Host ""
Write-Host "6. Dependances installees:" -ForegroundColor Yellow
$backendNodeModules = Test-Path "backend/node_modules"
$frontendNodeModules = Test-Path "frontend/node_modules"

Write-Host "   Backend node_modules: " -NoNewline
if ($backendNodeModules) {
    Write-Host "OK" -ForegroundColor Green
} else {
    Write-Host "MANQUANT" -ForegroundColor Red
    Write-Host "      Solution: cd backend && npm install" -ForegroundColor Yellow
    $allOK = $false
}

Write-Host "   Frontend node_modules: " -NoNewline
if ($frontendNodeModules) {
    Write-Host "OK" -ForegroundColor Green
} else {
    Write-Host "MANQUANT" -ForegroundColor Red
    Write-Host "      Solution: cd frontend && npm install" -ForegroundColor Yellow
    $allOK = $false
}

# Vérifier les fichiers .env
Write-Host ""
Write-Host "7. Fichiers de configuration:" -ForegroundColor Yellow
$backendEnv = Test-Path "backend/.env"
$frontendEnv = Test-Path "frontend/.env.local"

Write-Host "   Backend .env: " -NoNewline
if ($backendEnv) {
    Write-Host "OK" -ForegroundColor Green
} else {
    Write-Host "MANQUANT" -ForegroundColor Red
    $allOK = $false
}

Write-Host "   Frontend .env.local: " -NoNewline
if ($frontendEnv) {
    Write-Host "OK" -ForegroundColor Green
} else {
    Write-Host "MANQUANT" -ForegroundColor Red
    $allOK = $false
}

# Résumé
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
if ($allOK) {
    Write-Host "     RESULTAT: TOUS LES SERVICES FONCTIONNENT!" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Application accessible a: http://localhost:3000" -ForegroundColor Cyan
} else {
    Write-Host "     RESULTAT: CERTAINS PROBLEMES DETECTES" -ForegroundColor Red
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Consultez les messages ci-dessus pour les solutions." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour demarrer l'application:" -ForegroundColor White
    Write-Host "  1. Executez: DEMARRAGE-COMPLET.ps1" -ForegroundColor Cyan
    Write-Host "  2. Ou double-cliquez sur: DEMARRER-NOUVEAU.bat" -ForegroundColor Cyan
}

Write-Host ""
Read-Host "Appuyez sur Entree pour fermer"
