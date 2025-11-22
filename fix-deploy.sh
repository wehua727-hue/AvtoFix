#!/bin/bash

# Deploy fix skripti

echo "=== Deploy Fix ==="
echo ""

# 1. Git conflict marker'larni tozalash
echo "1. Git conflict marker'larni tozalash..."
sed -i '/^<<<<<<< Updated upstream$/d' ecosystem.config.cjs
sed -i '/^=======$/d' ecosystem.config.cjs
sed -i '/^>>>>>>> Stashed changes$/d' ecosystem.config.cjs
echo "✓ Tozalandi"
echo ""

# 2. Build qilish
echo "2. Build qilinmoqda..."
pnpm run build
echo ""

# 3. PM2 ni to'xtatish
echo "3. PM2 to'xtatilmoqda..."
pm2 stop oflayn-dokon 2>/dev/null || echo "PM2 process topilmadi"
pm2 delete oflayn-dokon 2>/dev/null || echo "PM2 process topilmadi"
echo ""

# 4. Logs papkasini yaratish
echo "4. Logs papkasi yaratilmoqda..."
mkdir -p logs
echo "✓ Yaratildi"
echo ""

# 5. PM2 ni ishga tushirish
echo "5. PM2 ishga tushirilmoqda..."
pm2 start ecosystem.config.cjs
echo ""

# 6. PM2 ni saqlash
echo "6. PM2 saqlanmoqda..."
pm2 save
echo ""

# 7. Status tekshirish
echo "7. Status tekshirilmoqda..."
sleep 3
pm2 status
echo ""

# 8. Health check
echo "8. Health check..."
sleep 2
curl -s http://localhost:5173/api/health && echo " ✓ Server ishlayapti!" || echo " ✗ Server javob bermayapti"
echo ""

echo "=== Deploy fix yakunlandi ==="

