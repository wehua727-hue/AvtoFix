#!/bin/bash

# Server holatini tekshirish skripti

echo "=== Server Holatini Tekshirish ==="
echo ""

# 1. PM2 status
echo "1. PM2 Status:"
pm2 status
echo ""

# 2. Port tekshirish
echo "2. Port 5173 tekshirish:"
if command -v netstat &> /dev/null; then
    netstat -tulpn | grep 5173 || echo "Port 5173 ishlamayapti"
elif command -v ss &> /dev/null; then
    ss -tulpn | grep 5173 || echo "Port 5173 ishlamayapti"
else
    echo "netstat yoki ss topilmadi"
fi
echo ""

# 3. Health check
echo "3. Health Check:"
curl -s http://localhost:5173/api/health || echo "Server javob bermayapti"
echo ""

# 4. PM2 loglar (oxirgi 20 qator)
echo "4. PM2 Loglar (oxirgi 20 qator):"
pm2 logs oflayn-dokon --lines 20 --nostream
echo ""

# 5. Build fayl mavjudligi
echo "5. Build fayl mavjudligi:"
if [ -f "dist/server/production.mjs" ]; then
    echo "✓ dist/server/production.mjs mavjud"
    ls -lh dist/server/production.mjs
else
    echo "✗ dist/server/production.mjs topilmadi!"
fi
echo ""

# 6. Environment variables
echo "6. Environment Variables:"
echo "PORT: ${PORT:-not set}"
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo ""

echo "=== Tekshirish yakunlandi ==="

