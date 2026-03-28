@echo off
echo 🚀 Building AvtoFix for Production...

REM 1. Clean previous builds
echo 🧹 Cleaning previous builds...
if exist dist rmdir /s /q dist
if exist node_modules\.vite rmdir /s /q node_modules\.vite

REM 2. Install dependencies
echo 📦 Installing dependencies...
pnpm install --frozen-lockfile

REM 3. Set production environment
echo 🔧 Setting production environment...
set NODE_ENV=production

REM 4. Build client (frontend)
echo 🏗️ Building client...
pnpm run build:client

REM 5. Build server (backend)
echo 🏗️ Building server...
pnpm run build:server

REM 6. Copy environment files to dist
echo 📋 Copying environment files...
if exist .env.production (
    copy .env.production dist\.env
    echo ✅ Copied .env.production to dist
) else (
    copy .env dist\.env
    echo ⚠️ Copied .env to dist
)

REM 7. Create logs directory
echo 📁 Creating logs directory...
if not exist logs mkdir logs

echo ✅ Production build completed!
echo 📂 Files are in: .\dist\
echo 🚀 Start with: pnpm run pm2:start