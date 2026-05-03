@echo off
echo.
echo ===============================================
echo  INITIALISATION BASE DE DONNEES
echo ===============================================
echo.

cd backend

echo [1/3] Generation du client Prisma...
call npm run db:generate
if errorlevel 1 (
    echo ERREUR lors de la generation
    pause
    exit /b 1
)
echo OK
echo.

echo [2/3] Synchronisation du schema...
call npm run db:push
if errorlevel 1 (
    echo ERREUR lors du push
    pause
    exit /b 1  
)
echo OK
echo.

echo [3/3] Seeding des donnees...
call npm run db:seed
if errorlevel 1 (
    echo ERREUR lors du seeding
    pause
    exit /b 1
)
echo OK
echo.

echo ===============================================
echo  BASE DE DONNEES PRETE!
echo ===============================================
echo.
echo Vous pouvez maintenant utiliser l'application.
echo.
pause
