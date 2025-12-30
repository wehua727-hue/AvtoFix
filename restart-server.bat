@echo off
echo Restarting server to clear any cache...
echo.

echo Killing any existing server processes...
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul

echo Starting server...
cd server
start "Server" cmd /k "npm run dev"

echo.
echo Server restarted. Please wait a few seconds for it to start up.
echo Then refresh your browser and test again.
echo.
pause