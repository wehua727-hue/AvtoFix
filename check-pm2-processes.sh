#!/bin/bash

# PM2 processlarni tekshirish

echo "=== PM2 Processlarni Tekshirish ==="
echo ""

# 1. oflayn-dokon process
echo "1. oflayn-dokon process:"
pm2 info oflayn-dokon | grep -E "script|path|status"
echo ""

# 2. avtofix-backend process
echo "2. avtofix-backend process:"
pm2 info avtofix-backend | grep -E "script|path|status"
echo ""

# 3. Port tekshirish
echo "3. Port tekshirish:"
echo "oflayn-dokon port:"
pm2 logs oflayn-dokon --lines 5 --nostream | grep -i "port\|running" || echo "Port topilmadi"
echo ""
echo "avtofix-backend port:"
pm2 logs avtofix-backend --lines 5 --nostream | grep -i "port\|running" || echo "Port topilmadi"
echo ""

echo "=== Tekshirish yakunlandi ==="

