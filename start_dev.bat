@echo off
title DaashTics Monorepo Launcher
echo ===================================================
echo    DAASHTICS ENTERPRISE MONOREPO LAUNCHER
echo ===================================================
echo Membersihkan instance lama di port 5000...
for /f "tokens=5" %%a in ('%SystemRoot%\System32\netstat.exe -aon ^| %SystemRoot%\System32\findstr.exe ":5000" ^| %SystemRoot%\System32\findstr.exe "LISTENING"') do %SystemRoot%\System32\taskkill.exe /f /pid %%a >nul 2>&1

echo [1/2] Memulai Flask REST API dan Computer Vision Engine (:5000)...
start "DaashTics Backend (:5000)" cmd /k "cd backend && ..\venv\Scripts\activate.bat && python run.py"

echo [2/2] Memulai Next.js 14 Web Application (:3000)...
start "DaashTics Frontend (:3000)" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo Selesai! Kedua server sedang berjalan:
echo - Frontend : http://localhost:3000
echo - Backend  : http://localhost:5000
echo ===================================================
pause
