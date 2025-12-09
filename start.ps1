# Script de démarrage pour TUSMO Multijoueur (PowerShell)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TUSMO MULTIJOUEUR - DEMARRAGE" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Démarrer le serveur WebSocket
Write-Host "[1/2] Demarrage du serveur WebSocket (port 8081)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node server\server.js" -WindowStyle Minimized
Start-Sleep -Seconds 2

# Démarrer le serveur HTTP
Write-Host "[2/2] Demarrage du serveur HTTP (port 8080)..." -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SERVEURS DEMARRES" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "- WebSocket: ws://localhost:8081" -ForegroundColor White
Write-Host "- HTTP: http://localhost:8080" -ForegroundColor White
Write-Host "- Reseau local: http://10.30.41.245:8080" -ForegroundColor White
Write-Host ""
Write-Host "Appuyez sur Ctrl+C pour arreter les serveurs" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

python -m http.server 8080
