#!/bin/bash

# Tezkor tuzatish skripti

echo "=== Tezkor Tuzatish ==="
echo ""

# 1. Backend serverni tekshirish va ishga tushirish
echo "1. Backend serverni tekshirish..."
if ! pm2 list | grep -q "oflayn-dokon"; then
    echo "   Backend server ishlamayapti, ishga tushirilmoqda..."
    cd /var/www/avtofix-shop/AvtoFix
    mkdir -p logs
    pm2 start ecosystem.config.cjs
    pm2 save
    sleep 3
else
    echo "   ✓ Backend server ishlayapti"
fi

# 2. Backend server health check
echo ""
echo "2. Backend server health check..."
if curl -s http://localhost:5173/api/health | grep -q "ok"; then
    echo "   ✓ Backend server ishlayapti va javob beradi"
else
    echo "   ✗ Backend server javob bermayapti!"
    echo "   PM2 loglarni ko'ring: pm2 logs oflayn-dokon"
    exit 1
fi

# 3. Nginx config faylini topish
echo ""
echo "3. Nginx config faylini topish..."
NGINX_CONFIG=$(find /etc/nginx/sites-available -name "*avtofix*" -o -name "*shop*" 2>/dev/null | head -1)
if [ -z "$NGINX_CONFIG" ]; then
    NGINX_CONFIG="/etc/nginx/sites-available/shop.avtofix.uz"
fi
echo "   Config fayl: $NGINX_CONFIG"

# 4. Nginx config'ni yangilash
if [ -f "$NGINX_CONFIG" ]; then
    echo ""
    echo "4. Nginx config'ni yangilash..."
    
    # Yedeklash
    cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Config'ni yangilash (faqat /api va /uploads qismini)
    sed -i '/location \/api/,/^    }/c\
    location /api {\
        proxy_pass http://127.0.0.1:5173;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '\''upgrade'\'';\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
        proxy_read_timeout 300s;\
        proxy_connect_timeout 75s;\
    }' "$NGINX_CONFIG"
    
    # /uploads qismini ham yangilash
    if ! grep -q "location /uploads" "$NGINX_CONFIG"; then
        sed -i '/location \/api/a\
    location /uploads {\
        proxy_pass http://127.0.0.1:5173;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
    }' "$NGINX_CONFIG"
    fi
    
    echo "   ✓ Config yangilandi"
else
    echo ""
    echo "4. ✗ Nginx config fayl topilmadi!"
    echo "   Qo'lda yarating: /etc/nginx/sites-available/shop.avtofix.uz"
    exit 1
fi

# 5. Nginx config'ni tekshirish
echo ""
echo "5. Nginx config'ni tekshirish..."
if nginx -t; then
    echo "   ✓ Nginx config to'g'ri"
else
    echo "   ✗ Nginx config xatosi!"
    exit 1
fi

# 6. Nginx ni qayta yuklash
echo ""
echo "6. Nginx ni qayta yuklash..."
systemctl reload nginx || service nginx reload
echo "   ✓ Nginx qayta yuklandi"

# 7. Test
echo ""
echo "7. Test qilinmoqda..."
sleep 2
if curl -s https://shop.avtofix.uz/api/health | grep -q "ok"; then
    echo "   ✓ API ishlayapti!"
else
    echo "   ✗ API hali ham ishlamayapti"
    echo "   Tekshiring: curl http://localhost:5173/api/health"
fi

echo ""
echo "=== Tuzatish yakunlandi ==="

