#!/bin/bash

# Server to'g'ridan-to'g'ri ishga tushirish va xatolarni ko'rish

cd /var/www/avtofix-shop/AvtoFix

echo "=== Server Test ==="
echo ""

# 1. PM2 ni to'xtatish
echo "1. PM2 ni to'xtatish..."
pm2 stop oflayn-dokon
echo ""

# 2. Build fayl mavjudligini tekshirish
echo "2. Build fayl mavjudligini tekshirish..."
if [ ! -f "dist/server/node-build.mjs" ]; then
    echo "✗ Build fayl topilmadi, build qilinmoqda..."
    pnpm run build
fi
ls -la dist/server/node-build.mjs
echo ""

# 3. Environment variables tekshirish
echo "3. Environment variables:"
echo "PORT: ${PORT:-not set}"
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo ""

# 4. Server to'g'ridan-to'g'ri ishga tushirish (xatolarni ko'rish uchun)
echo "4. Server to'g'ridan-to'g'ri ishga tushirilmoqda..."
echo "   (Ctrl+C bosib to'xtating, xatolarni ko'ring)"
echo ""

PORT=5173 NODE_ENV=production node dist/server/node-build.mjs

