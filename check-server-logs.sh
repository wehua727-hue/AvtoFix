#!/bin/bash

# Server loglarini tekshirish va tuzatish

cd /var/www/avtofix-shop/AvtoFix

echo "=== Server Loglarini Tekshirish ==="
echo ""

# 1. PM2 loglarni ko'rish
echo "1. PM2 loglarni ko'rish (oxirgi 30 qator):"
pm2 logs oflayn-dokon --lines 30 --nostream
echo ""

# 2. Error loglarni ko'rish
echo "2. Error loglar:"
if [ -f "logs/pm2-error.log" ]; then
    tail -30 logs/pm2-error.log
else
    echo "Error log fayl topilmadi"
fi
echo ""

# 3. Output loglarni ko'rish
echo "3. Output loglar:"
if [ -f "logs/pm2-out.log" ]; then
    tail -30 logs/pm2-out.log
else
    echo "Output log fayl topilmadi"
fi
echo ""

# 4. Port tekshirish
echo "4. Port 5173 tekshirish:"
netstat -tulpn | grep 5173 || ss -tulpn | grep 5173 || echo "Port 5173 ishlamayapti"
echo ""

# 5. Process tekshirish
echo "5. Process tekshirish:"
ps aux | grep node-build.mjs | grep -v grep
echo ""

echo "=== Tekshirish yakunlandi ==="

