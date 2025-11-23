#!/bin/bash

# Ecosystem.config.cjs faylini to'g'ri yaratish

cd /var/www/avtofix-shop/AvtoFix

echo "Ecosystem.config.cjs faylini yaratish..."

# Eski faylni yedeklash
if [ -f ecosystem.config.cjs ]; then
    mv ecosystem.config.cjs ecosystem.config.cjs.old
fi

# To'g'ri faylni yaratish
cat > ecosystem.config.cjs << 'ENDOFFILE'
module.exports = {
  apps: [
    {
      name: 'oflayn-dokon',
      script: './dist/server/production.mjs',
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
ENDOFFILE

echo "✓ Fayl yaratildi"

# Syntax tekshirish
echo "Syntax tekshirilmoqda..."
node -c ecosystem.config.cjs && echo "✓ Syntax to'g'ri" || echo "✗ Syntax xatosi"

echo ""
echo "Endi quyidagilarni bajaring:"
echo "  mkdir -p logs"
echo "  pm2 start ecosystem.config.cjs"
echo "  pm2 save"
echo "  pm2 status"

