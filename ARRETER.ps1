# ================================================================
# ARRÊT PROPRE DE L'APPLICATION
# ================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Red
Write-Host "     ARRET DE L'APPLICATION SALON DE COIFFURE" -ForegroundColor Red
Write-Host "================================================================" -ForegroundColor Red
Write-Host ""

# Arrêter les processus Node.js
Write-Host "Arret des services Node.js (Backend + Frontend)..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "   Arret du processus: $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Gray
    Stop-Process -Id $_.Id -Force
}
Write-Host "   OK - Services Node.js arretes" -ForegroundColor Green

# Optionnel: Arrêter PostgreSQL
Write-Host ""
$stopPostgres = Read-Host "Voulez-vous aussi arreter PostgreSQL? (o/n)"
if ($stopPostgres -eq "o" -or $stopPostgres -eq "O") {
    Write-Host "Arret de PostgreSQL..." -ForegroundColor Yellow
    docker-compose down
    Write-Host "   OK - PostgreSQL arrete" -ForegroundColor Green
} else {
    Write-Host "PostgreSQL reste en cours d'execution" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "     APPLICATION ARRETEE" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Pour redemarrer: Double-cliquez sur DEMARRER-NOUVEAU.bat" -ForegroundColor Cyan
Write-Host ""

Read-Host "Appuyez sur Entree pour fermer"
