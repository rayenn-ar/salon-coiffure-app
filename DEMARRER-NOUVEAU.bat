@echo off
chcp 65001 >nul
REM ================================================================
REM  SALON DE COIFFURE - LANCEMENT RAPIDE
REM  Script sans emojis pour eviter les problemes d'encodage
REM ================================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"
cls

echo.
echo ================================================================
echo.
echo       SALON DE COIFFURE - DEMARRAGE DE L'APPLICATION
echo.
echo ================================================================
echo.

REM Lancer le script PowerShell qui gere tout
powershell -ExecutionPolicy Bypass -File "%~dp0DEMARRAGE-COMPLET.ps1"

if errorlevel 1 (
    echo.
    echo ERREUR: Le demarrage a echoue
    echo.
    pause
    exit /b 1
)

exit /b 0
