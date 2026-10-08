@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Instal Node.js 22+ dari https://nodejs.org/
  pause
  exit /b 1
)
echo ===========================================
echo   SIMULATOR +62 - Multiplayer Milestone B
 echo ===========================================
echo.
echo Buka browser: http://localhost:3000
echo Untuk berhenti tekan Ctrl+C.
echo.
node server.js
pause
