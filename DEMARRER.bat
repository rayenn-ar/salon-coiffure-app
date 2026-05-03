@echo off
REM ================================================================
REM  SALON DE COIFFURE - LANCEMENT COMPLÈT ET FINAL
REM ================================================================
REM Ce script lance completement l'application avec tous les services

setlocal enabledelayedexpansion

REM Configure le chemin
cd /d "%~dp0"

cls

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║          🎨 SALON DE COIFFURE                            ║
echo ║                                                            ║
echo ║         DÉMARRAGE COMPLET DE L'APPLICATION                ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM =========== VÉRIFICATION DOCKER ===========
echo [ÉTAPE 1/7] Vérification de Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ ERREUR: Docker n'est pas installé ou n'est pas en cours d'exécution
    echo.
    echo 📥 Installez Docker Desktop:
    echo    https://www.docker.com/products/docker-desktop
    echo.
    echo ⚠️  Ensuite, redémarrez ce script.
    echo.
    pause
    exit /b 1
)
echo ✅ Docker trouvé et accessible
echo.

REM =========== DÉMARRAGE POSTGRESQL ===========
echo [ÉTAPE 2/7] Démarrage de PostgreSQL en Docker...
echo.

REM Vérifier si le conteneur existe déjà
docker ps -a --format "table {{.Names}}" | findstr "salon-postgres" >nul 2>&1
if errorlevel 1 (
    echo   Premier lancement: création du conteneur...
) else (
    docker ps --format "table {{.Names}}" | findstr "salon-postgres" >nul 2>&1
    if errorlevel 1 (
        echo   Conteneur trouvé mais à l'arrêt. Redémarrage...
        docker-compose up -d postgres >nul 2>&1
    ) else (
        echo   Conteneur déjà en cours d'exécution
    )
)

REM Démarrer PostgreSQL
docker-compose up -d postgres
if errorlevel 1 (
    echo ❌ Erreur lors du démarrage de PostgreSQL
    pause
    exit /b 1
)

echo PostgreSQL en cours de démarrage...
echo Attente de 10 secondes...
timeout /t 10 /nobreak
echo ✅ PostgreSQL prêt
echo.

REM =========== CONFIGURATION BACKEND ===========
echo [ÉTAPE 3/7] Configuration du Backend...
cd backend

REM Vérifier et installer les dépendances
if not exist node_modules (
    echo   Installation des dépendances npm (cela peut prendre 1-2 minutes)...
    call npm install
    if errorlevel 1 (
        echo ❌ Erreur lors de npm install
        pause
        exit /b 1
    )
)

REM Générer Prisma client
echo   Génération du client Prisma...
call npm run db:generate
if errorlevel 1 (
    echo ❌ Erreur lors de db:generate
    pause
    exit /b 1
)

REM Synchroniser la base de données
echo   Synchronisation de la base de données...
call npm run db:push -- --skip-generate
if errorlevel 1 (
    echo ⚠️  Avertissement lors de db:push
)

REM Seeder optionnel
echo   Seeding de la base de données...
call npm run db:seed >nul 2>&1

echo ✅ Backend configuré
cd ..
echo.

REM =========== CONFIGURATION FRONTEND ===========
echo [ÉTAPE 4/7] Configuration du Frontend...
cd frontend

REM Vérifier et installer les dépendances
if not exist node_modules (
    echo   Installation des dépendances npm (cela peut prendre 1-2 minutes)...
    call npm install
    if errorlevel 1 (
        echo ❌ Erreur lors de npm install frontend
        pause
        exit /b 1
    )
)

echo ✅ Frontend configuré
cd ..
echo.

REM =========== RÉSUMÉ ===========
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║          ✅ CONFIGURATION TERMINÉE                        ║
echo ║                                                            ║
echo ║   Les services sont prêts à être lancés                   ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo [ÉTAPE 5/7] Lancement du Backend...
echo   Les services vont s'ouvrir dans des terminaux séparés
echo.
echo   Gardez ces fenêtres ouvertes pendant que vous utilisez l'app
echo   Fermez-les pour arrêter tous les services
echo.

REM Lancer le backend dans une nève fenêtre
start "🔌 BACKEND API - Port 3001" cmd /k cd backend ^& npm run dev

REM Attendre que le backend soit prêt
timeout /t 3 /nobreak

echo [ÉTAPE 6/7] Lancement du Frontend...

REM Lancer le frontend dans une nouvelle fenêtre
start "🌐 FRONTEND WEB - Port 3000" cmd /k cd frontend ^& npm run dev

REM Attendre que le frontend soit prêt
timeout /t 5 /nobreak

echo [ÉTAPE 7/7] Ouverture du navigateur...

REM Essayer d'ouvrir le navigateur
start http://localhost:3000

REM Affichage final
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║          🎉 LANCEMENT COMPLET TERMINÉ 🎉                ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo.
echo 📍 L'APPLICATION EST MAINTENANT EN COURS D'EXÉCUTION:
echo.
echo    🌐 Frontend:        http://localhost:3000
echo    🔌 API Backend:     http://localhost:3001
echo    ✅ Health Check:    http://localhost:3001/health
echo    📊 Prisma Studio:   npm run db:studio (dans backend/)
echo.
echo.
echo 💾 BASE DE DONNÉES:
echo.
echo    PostgreSQL 16 sur localhost:5434
echo    User: postgres
echo    Password: postgres
echo    Database: salon_db
echo.
echo.
echo ⚙️  WINDOWS OUVERTES:
echo.
echo    ✓ Terminal Backend  - Exécute le serveur Express (port 3001)
echo    ✓ Terminal Frontend - Exécute le serveur Next.js (port 3000)
echo    ✓ Navigateur        - Page d'accueil de l'application
echo.
echo.
echo ⏹️  POUR ARRÊTER:
echo.
echo    1. Fermez les deux terminaux
echo    2. Ou tapez Ctrl+C dans chaque terminal
echo    3. Ou exécutez: docker-compose down
echo.
echo.
echo 📚 POUR PLUS D'AIDE:
echo.
echo    Consultez:
echo    • README.md - Guide complet
echo    • STARTUP_GUIDE.md - Instructions détaillées
echo    • 🚀_LIRE_MOI.txt - Résumé rapide
echo.
echo ════════════════════════════════════════════════════════════
echo.

REM Garder la fenêtre ouverte
pause
