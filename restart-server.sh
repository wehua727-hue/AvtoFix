#!/bin/bash

# Server qayta ishga tushirish skripti

echo "=== Server Qayta Ishga Tushirish ==="
echo ""

# 1. Build qilish
echo "1. Build qilinmoqda..."
pnpm run build || npm run build
echo ""

# 2. PM2 ni to'xtatish
echo "2. PM2 to'xtatilmoqda..."
pm2 stop oflayn-dokon 2>/dev/null || echo "PM2 process topilmadi"
pm2 delete oflayn-dokon 2>/dev/null || echo "PM2 process topilmadi"
echo ""

# 3. PM2 ni ishga tushirish
echo "3. PM2 ishga tushirilmoqda..."
pm2 start ecosystem.config.cjs
echo ""

# 4. PM2 ni saqlash
echo "4. PM2 saqlanmoqda..."
pm2 save
echo ""

# 5. Status tekshirish
echo "5. Status tekshirilmoqda..."
sleep 3
pm2 status
echo ""

# 6. Health check
echo "6. Health check..."
sleep 2
curl -s http://localhost:5173/api/health && echo " ✓ Server ishlayapti!" || echo " ✗ Server javob bermayapti"
echo ""

echo "=== Qayta ishga tushirish yakunlandi ==="

