@echo off
chcp 65001 >nul
echo.
echo ================================================================
echo  ARRET DE L'APPLICATION
echo ================================================================
echo.

echo Arret des processus Node.js...
taskkill /F /IM node.exe >nul 2>&1
if errorlevel 1 (
    echo   Aucun processus Node.js en cours
) else (
    echo   OK - Processus arretes
)

echo.
echo ================================================================
echo  APPLICATION ARRETEE
echo ================================================================
echo.
echo Pour redemarrer: DEMARRER-NOUVEAU.bat
echo.
pause
