#!/bin/bash

# Nginx config'ni tuzatish

echo "=== Nginx Fix ==="
echo ""

# 1. Nginx config faylini topish
echo "1. Nginx config faylini topish..."
NGINX_CONFIG=$(find /etc/nginx/sites-available -name "*avtofix*" -o -name "*shop*" 2>/dev/null | head -1)
if [ -z "$NGINX_CONFIG" ]; then
    NGINX_CONFIG="/etc/nginx/sites-available/shop.avtofix.uz"
fi
echo "Config fayl: $NGINX_CONFIG"
echo ""

# 2. Config mavjudligini tekshirish
if [ ! -f "$NGINX_CONFIG" ]; then
    echo "✗ Config fayl topilmadi: $NGINX_CONFIG"
    echo "Qo'lda yarating yoki boshqa joyda qidiring:"
    find /etc/nginx -name "*.conf" -o -name "*avtofix*" 2>/dev/null
    exit 1
fi

# 3. Yedeklash
echo "2. Yedeklash..."
cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✓ Yedek yaratildi"
echo ""

# 4. Config'ni ko'rsatish
echo "3. Hozirgi config:"
cat "$NGINX_CONFIG"
echo ""

# 5. Config'ni yangilash
echo "4. Config'ni yangilash..."
echo ""
echo "Quyidagi qismni qo'shing yoki yangilang:"
echo ""
echo "location /api {"
echo "    proxy_pass http://127.0.0.1:5173;"
echo "    proxy_http_version 1.1;"
echo "    proxy_set_header Upgrade \$http_upgrade;"
echo "    proxy_set_header Connection 'upgrade';"
echo "    proxy_set_header Host \$host;"
echo "    proxy_set_header X-Real-IP \$remote_addr;"
echo "    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
echo "    proxy_set_header X-Forwarded-Proto \$scheme;"
echo "    proxy_cache_bypass \$http_upgrade;"
echo "    proxy_read_timeout 300s;"
echo "    proxy_connect_timeout 75s;"
echo "}"
echo ""
echo "location /uploads {"
echo "    proxy_pass http://127.0.0.1:5173;"
echo "    proxy_http_version 1.1;"
echo "    proxy_set_header Host \$host;"
echo "    proxy_set_header X-Real-IP \$remote_addr;"
echo "    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
echo "    proxy_set_header X-Forwarded-Proto \$scheme;"
echo "}"
echo ""

echo "Config faylni tahrirlash uchun:"
echo "  sudo nano $NGINX_CONFIG"
echo ""
echo "Keyin:"
echo "  sudo nginx -t"
echo "  sudo systemctl reload nginx"

