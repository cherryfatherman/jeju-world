@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [!] Node.js is not installed. Please install the LTS version from https://nodejs.org
  start "" https://nodejs.org
  pause
  exit /b
)
echo.
echo [1/2] Installing... please wait
call npm install --no-fund --no-audit
echo.
echo [2/2] Starting Jeju World. Do NOT close this window while using it.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000/map.html"
node server.js
pause
