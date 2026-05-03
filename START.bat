@echo off
chcp 65001 >nul
cls

echo.
echo ================================================================
echo       DEMARRAGE SALON DE COIFFURE
echo ================================================================
echo.

echo [1] Verification Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo     ERREUR: Docker non trouve
    pause
    exit /b 1
)
echo     OK
echo.

echo [2] Demarrage PostgreSQL...
docker-compose up -d postgres >nul 2>&1
echo     OK - Attente initialisation...
timeout /t 3 /nobreak >nul
echo.

echo [3] Configuration Backend...
cd backend
if not exist node_modules (
    echo     Installation dependances...
    call npm install >nul 2>&1
)
call npm run db:generate >nul 2>&1
call npm run db:push >nul 2>&1
call npm run db:seed >nul 2>&1
echo     OK
cd ..
echo.

echo [4] Configuration Frontend...
cd frontend
if not exist node_modules (
    echo     Installation dependances...
    call npm install >nul 2>&1
)
echo     OK
cd ..
echo.

echo ================================================================
echo       LANCEMENT DES SERVICES
echo ================================================================
echo.

echo [5] Backend (port 3001)...
start "Backend API - Port 3001" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul

echo [6] Frontend (port 3000)...
start "Frontend Web - Port 3000" cmd /k "cd frontend && npm run dev"
timeout /t 5 /nobreak >nul

echo [7] Ouverture navigateur...
start http://localhost:3000

cls
echo.
echo ================================================================
echo          APPLICATION LANCEE AVEC SUCCES!
echo ================================================================
echo.
echo   Frontend:     http://localhost:3000
echo   Backend API:  http://localhost:3001
echo   Health:       http://localhost:3001/health
echo.
echo   Admin:    admin@salon-beaute.fr / admin12345
echo   Cliente:  test@cliente.fr / cliente123
echo.
echo   2 fenetres ouvertes: Backend + Frontend
echo   NE LES FERMEZ PAS pendant l'utilisation
echo.
echo   Pour arreter: Fermez les 2 fenetres
echo.
echo ================================================================
echo.
pause
