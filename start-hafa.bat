@echo off
echo ========================================
echo   Starting Hafa Market Backend
echo ========================================

echo [1/2] Starting Redis...
start "Redis" /min C:\Users\PC\redis\redis-server.exe --port 6379

timeout /t 2 /nobreak > nul

echo [2/2] Starting API Server...
cd /d "%~dp0backend"
npm run dev

pause
