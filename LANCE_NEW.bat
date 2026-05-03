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
echo [3/8] 🔍 Vérification Docker Desktop...
docker ps >nul 2>&1
if errorlevel 1 (
    echo     ⚠️  Docker Desktop n'est pas démarré!
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
echo [4/8] 🗄️  Démarrage PostgreSQL...
docker compose up -d postgres
if errorlevel 1 (
    echo     ❌ ERREUR PostgreSQL!
    docker compose logs postgres
    pause
    exit /b 1
)
echo     ⏳ Attente du démarrage de PostgreSQL...
timeout /t 10 /nobreak >nul
echo     ✓ PostgreSQL est actif sur le port 5434

echo.
echo [5/8] 📦 Vérification des dépendances backend...
cd backend
if not exist node_modules (
    echo     📥 Installation des dépendances (première fois)...
    call npm install
    if errorlevel 1 (
        echo     ❌ Erreur lors de l'installation npm backend!
        pause
        exit /b 1
    )
) else (
    echo     ✓ Dépendances backend déjà installées
)

echo.
echo [6/8] 🔧 Configuration Prisma...
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

echo [8/8] 🌐 Démarrage des serveurs...
echo.

echo     🔧 Lancement Backend (port 3001)...
start "🔧 Backend - Salon de Coiffure" cmd /k "cd /d "%~dp0backend" && echo Backend en cours de demarrage... && npm run dev"
timeout /t 5 /nobreak >nul

echo     💻 Lancement Frontend (port 3000)...
start "💻 Frontend - Salon de Coiffure" cmd /k "cd /d "%~dp0frontend" && echo Frontend en cours de demarrage... && npm run dev"

echo.
echo     ⏳ Attente du démarrage complet (15 secondes)...
timeout /t 15 /nobreak >nul

echo.
echo ════════════════════════════════════════════════════
echo   ✅ APPLICATION SALON DE COIFFURE LANCÉE !
echo ════════════════════════════════════════════════════
echo.
echo   📂 Dossier:      %~dp0
echo   🔧 Backend:      http://localhost:3001/api
echo   💻 Frontend:     http://localhost:3000
echo   🗄️  Database:     PostgreSQL sur localhost:5434
echo.
echo   👤 Identifiants Admin:
echo      Email:        admin@salon-beaute.fr
echo      Mot de passe: admin12345
echo.
echo ════════════════════════════════════════════════════
echo.
echo 🌐 Ouverture du navigateur...
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo ✨ Attendez l'affichage de la page:
echo    "Révélez votre beauté naturelle"
echo.
echo 📝 Si vous voyez cette page avec design rose/violet,
echo    tout fonctionne parfaitement ! 💇‍♀️
echo.
echo ⚠️  Pour arrêter l'application, fermez les 2 fenêtres
echo    "Backend" et "Frontend", puis tapez:
echo    docker compose down
echo.
pause
