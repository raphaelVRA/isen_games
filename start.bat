@echo off
echo ========================================
echo   TUSMO MULTIJOUEUR - DEMARRAGE
echo ========================================
echo.

REM Démarrer le serveur WebSocket en arrière-plan
echo [1/2] Demarrage du serveur WebSocket (port 8081)...
start /B node server\server.js
timeout /t 2 /nobreak >nul

REM Démarrer le serveur HTTP
echo [2/2] Demarrage du serveur HTTP (port 8080)...
echo.
echo ========================================
echo   SERVEURS DEMARRES
echo ========================================
echo.
echo - WebSocket: ws://localhost:8081
echo - HTTP: http://localhost:8080
echo - Reseau local: http://10.30.41.245:8080
echo.
echo Appuyez sur Ctrl+C pour arreter les serveurs
echo ========================================
echo.

python -m http.server 8080
