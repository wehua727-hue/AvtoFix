@echo off
setlocal enabledelayedexpansion
echo ========================================
echo   Oflayn Dokon - Clean Rebuild Script
echo ========================================
echo.

:: Check config.json
if not exist "electron\config.json" (
    echo [ERROR] electron\config.json not found!
    echo.
    echo Please create it from electron\config.example.json:
    echo   copy electron\config.example.json electron\config.json
    echo.
    echo Then edit it with your MongoDB credentials.
    pause
    exit /b 1
)

echo [OK] electron\config.json found
echo.

:: Kill any running Electron processes
echo [1/5] Closing Electron processes...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM "Oflayn Dokon.exe" >nul 2>&1
timeout /t 2 /nobreak >nul
echo   Done!
echo.

:: Clean old builds
echo [2/5] Cleaning old builds...
if exist "release" (
    echo   Removing release/
    :: Try to remove with retry
    set retries=3
    :retry_release
    rmdir /s /q release 2>nul
    if exist "release" (
        set /a retries-=1
        if !retries! gtr 0 (
            timeout /t 1 /nobreak >nul
            goto retry_release
        ) else (
            echo   [WARNING] Could not fully remove release/, some files may be locked
        )
    )
)
if exist "dist" (
    echo   Removing dist/
    rmdir /s /q dist
)
if exist ".vite" (
    echo   Removing .vite/
    rmdir /s /q .vite
)
echo   Done!
echo.

:: Build client
echo [3/5] Building client (Vite)...
call pnpm run build:client
if errorlevel 1 (
    echo [ERROR] Client build failed!
    pause
    exit /b 1
)
echo   Done!
echo.

:: Check dist folder
if not exist "dist\index.html" (
    echo [ERROR] dist\index.html not found after build!
    pause
    exit /b 1
)
echo [OK] dist\index.html exists
echo.

:: Build Electron
echo [4/5] Building Electron app...
call pnpm exec electron-builder --win --config electron-builder.config.cjs
if errorlevel 1 (
    echo [ERROR] Electron build failed!
    pause
    exit /b 1
)
echo   Done!
echo.

:: Check output
echo [5/5] Checking output...
if exist "release\*.exe" (
    echo [SUCCESS] Build completed!
    echo.
    echo Output files:
    dir /b release\*.exe
    echo.
    echo Location: %cd%\release\
) else (
    echo [WARNING] No .exe file found in release/
)

echo.
echo ========================================
echo   Build process completed!
echo ========================================
pause
