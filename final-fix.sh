#!/bin/bash

# Final fix - barcha muammolarni tuzatish

cd /var/www/avtofix-shop/AvtoFix

echo "=== Final Fix ==="
echo ""

# 1. Ecosystem config'ni to'g'rilash
echo "1. Ecosystem config'ni to'g'rilash..."
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'oflayn-dokon',
      script: './dist/server/node-build.mjs',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 5173,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000,
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      node_args: '',
      ignore_watch: ['node_modules', 'logs', '.git'],
      source_map_support: true,
    },
  ],
};
EOF
echo "✓ Config to'g'rilandi"
echo ""

# 2. Build fayl mavjudligini tekshirish
echo "2. Build fayl mavjudligini tekshirish..."
if [ -f "dist/server/node-build.mjs" ]; then
    echo "✓ Build fayl mavjud: dist/server/node-build.mjs"
else
    echo "✗ Build fayl topilmadi, build qilinmoqda..."
    pnpm run build
fi
echo ""

# 3. Logs papkasini yaratish
echo "3. Logs papkasini yaratish..."
mkdir -p logs
echo "✓ Logs papkasi yaratildi"
echo ""

# 4. PM2 ni to'xtatish va o'chirish
echo "4. PM2 ni to'xtatish..."
pm2 stop oflayn-dokon 2>/dev/null || echo "  Process topilmadi"
pm2 delete oflayn-dokon 2>/dev/null || echo "  Process topilmadi"
echo ""

# 5. PM2 ni ishga tushirish
echo "5. PM2 ni ishga tushirish..."
pm2 start ecosystem.config.cjs
echo ""

# 6. PM2 ni saqlash
echo "6. PM2 ni saqlash..."
pm2 save
echo ""

# 7. Status tekshirish
echo "7. Status tekshirish..."
sleep 3
pm2 status | grep oflayn-dokon || echo "✗ Process ishlamayapti"
echo ""

# 8. Health check
echo "8. Health check..."
sleep 2
if curl -s http://localhost:5173/api/health | grep -q "ok"; then
    echo "✓ Backend server ishlayapti!"
else
    echo "✗ Backend server javob bermayapti"
    echo "PM2 loglarni ko'ring: pm2 logs oflayn-dokon"
fi
echo ""

echo "=== Fix yakunlandi ==="

