#!/bin/bash

# Nginx sozlamasini tekshirish va tuzatish

echo "=== Nginx Fix ==="
echo ""

# 1. Backend server holatini tekshirish
echo "1. Backend server holatini tekshirish..."
pm2 status | grep oflayn-dokon || echo "✗ Backend server PM2 da ishlamayapti!"
echo ""

# 2. Port tekshirish
echo "2. Port 5173 tekshirish..."
curl -s http://localhost:5173/api/health && echo " ✓ Backend server ishlayapti" || echo " ✗ Backend server javob bermayapti"
echo ""

# 3. Nginx config faylini topish
echo "3. Nginx config faylini topish..."
NGINX_CONFIG=$(find /etc/nginx -name "*avtofix*" -o -name "*shop*" 2>/dev/null | head -1)
if [ -z "$NGINX_CONFIG" ]; then
    NGINX_CONFIG="/etc/nginx/sites-available/shop.avtofix.uz"
fi
echo "Config fayl: $NGINX_CONFIG"
echo ""

# 4. Nginx config ko'rsatish
if [ -f "$NGINX_CONFIG" ]; then
    echo "4. Hozirgi Nginx config:"
    cat "$NGINX_CONFIG"
    echo ""
else
    echo "4. ✗ Nginx config fayl topilmadi!"
    echo ""
fi

echo "=== Tekshirish yakunlandi ==="

