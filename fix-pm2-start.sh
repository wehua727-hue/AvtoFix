#!/bin/bash

# PM2 ni to'g'ri ishga tushirish

cd /var/www/avtofix-shop/AvtoFix

echo "=== PM2 Fix ==="
echo ""

# 1. PM2 ni to'liq o'chirish
echo "1. PM2 ni o'chirish..."
pm2 delete oflayn-dokon 2>/dev/null || echo "  Process topilmadi"
echo ""

# 2. Ecosystem config'ni yangilash - RUN_SERVER=true qo'shish
echo "2. Ecosystem config'ni yangilash..."
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
        RUN_SERVER: 'true',
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
echo "✓ Config yangilandi"
echo ""

# 3. PM2 ni ishga tushirish
echo "3. PM2 ni ishga tushirish..."
pm2 start ecosystem.config.cjs
echo ""

# 4. PM2 ni saqlash
echo "4. PM2 ni saqlash..."
pm2 save
echo ""

# 5. Status tekshirish
echo "5. Status tekshirish..."
sleep 3
pm2 status | grep oflayn-dokon
echo ""

# 6. Health check
echo "6. Health check..."
sleep 2
if curl -s http://localhost:5173/api/health | grep -q "ok"; then
    echo "✓ Backend server ishlayapti!"
else
    echo "✗ Backend server javob bermayapti"
    echo "PM2 loglarni ko'ring: pm2 logs oflayn-dokon"
fi
echo ""

echo "=== Fix yakunlandi ==="

