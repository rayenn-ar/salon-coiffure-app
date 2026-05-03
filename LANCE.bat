@echo off
chcp 65001 >nul
cls
echo.
echo ════════════════════════════════════════════════════
echo    💇‍♀️ SALON DE COIFFURE - LANCEMENT COMPLET
echo ════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

echo [1/8] 🛑 Arrêt de TOUTES les applications Node.js...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM next-server.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo     ✓ Toutes les applications Node.js sont arrêtées

echo.
echo [2/8] 🐳 Nettoyage Docker...
docker rm -f salon-postgres >nul 2>&1
docker compose down >nul 2>&1
echo     ✓ Docker nettoyé

echo.
echo [3/8    ⚠️  Docker Desktop n'est pas démarré!
    echo     📦 Lancement de Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo     ⏳ Attente du démarrage...
    timeout /t 5 /nobreak >nul
    :WAIT_DOCKER
    docker ps >nul 2>&1
    if errorlevel 1 (
        timeout /t 2 /nobreak >nul
        goto WAIT_DOCKER
    )
    echo     ✓ Docker est prêt!
) else (
    echo     ✓ Docker Desktop est déjà actif
)

echo.
echo [4/8] 🗄️   ✓ Docker est prêt!
)

echo [4/7] Démarrage PostgreSQL...
docker compose up -d postgres
if errorlevel 1 (
    echo ❌ Erreur PostgreSQL! Vérification...
    docker compose logs postgres
    pause
    exit /b 1
)
timeout /t 10 /nobreak >nul
5/7] Installation backend...
cd backend
if not exist node_modules (
    echo    - npm install...
    npm install
)

echo [6
echo [6/7] Configuration Prisma...
echo     🔨 Génération du client Prisma...
call npm run db:generate
if errorlevel 1 (
    echo     ❌ Erreur lors de la génération Prisma!
    pause
    exit /b 1
)

echo     📊 Migration de la base de données...
call npm run db:push
if errorlevel 1 (
    echo     ❌ Erreur lors de la migration!
    pause
    exit /b 1
)
echo     ✓ Base de données configurée

echo.
echo [7/8] 📦 Vérification des dépendances frontend...
cd ..\frontend
if not exist node_modules (
    echo     📥 Installation des dépendances (première fois)...
    call npm install
    if errorlevel 1 (
        echo     ❌ Erreur lors de l'installation npm frontend!
        pause
        exit /b 1
    )
) else (
    echo     ✓ Dépendances frontend déjà installées
)

cd ..
echo.
echo ════════════════════════════════════════════════════
echo   🚀 LANCEMENT DES SERVEURS
echo ════════════════════════════════════════════════════
echo.
echo 📂 Projet: %~dp0
echo.

start "Backend Salon Coiffure" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 4 /nobreak >nul
SALON DE COIFFURE lancée!
echo.
echo    📂 Dossier: %~dp0
echo    🔧 Backend:  http://localhost:3001
echo    💻 Frontend: http://localhost:3000  
echo    🗄️  Database: localhost:5434
echo.
echo 🌐 Ouverture du navigateur vers VOTRE projet...
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
echo.
echo ✨ Attendez que la page "Révélez votre beauté naturelle" s'affiche
pause
echo.
echo ✅ Application lancée!
echo    - Backend:  http://localhost:3001
echo    - Frontend: http://localhost:3000
echo    - Database: localhost:5434
echo.
start http://localhost:3000
