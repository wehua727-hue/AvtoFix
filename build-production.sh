#!/bin/bash

echo "🚀 Building AvtoFix for Production..."

# 1. Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf node_modules/.vite/

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 3. Load production environment
echo "🔧 Loading production environment..."
export NODE_ENV=production
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
    echo "✅ Loaded .env.production"
else
    echo "⚠️  .env.production not found, using .env"
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
fi

# 4. Build client (frontend)
echo "🏗️ Building client..."
npm run build:client

# 5. Build server (backend)
echo "🏗️ Building server..."
npm run build:server

# 6. Copy environment files to dist
echo "📋 Copying environment files..."
if [ -f .env.production ]; then
    cp .env.production dist/.env
else
    cp .env dist/.env
fi

# 7. Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# 8. Set permissions
echo "🔐 Setting permissions..."
chmod +x dist/server/node-build.mjs

echo "✅ Production build completed!"
echo "📂 Files are in: ./dist/"
echo "🚀 Start with: npm run pm2:start"