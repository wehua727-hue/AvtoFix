#!/bin/bash

# Ecosystem.config.cjs faylini tozalash va qayta yaratish

cd /var/www/avtofix-shop/AvtoFix

echo "=== Ecosystem.config.cjs faylini tozalash ==="
echo ""

# Faylni yedeklash
cp ecosystem.config.cjs ecosystem.config.cjs.backup 2>/dev/null || echo "Yedek olinmadi"

# To'g'ri faylni yozish
cat > ecosystem.config.cjs << 'EOF'
/**
 * PM2 Ecosystem Configuration
 * ESM module uchun to'liq sozlangan
 */
module.exports = {
  apps: [
    {
      name: 'oflayn-dokon',
      script: './dist/server/production.mjs',
      
      // ESM module uchun sozlash
      interpreter: 'node',
      // ESM modullar Node.js da to'g'ridan-to'g'ri qo'llab-quvvatlanadi (package.json da "type": "module")
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 5173,
      },
      
      // PM2 sozlamalari
      instances: 1, // Fork mode (1 instance)
      exec_mode: 'fork',
      
      // Auto restart
      autorestart: true,
      watch: false, // Production'da watch o'chirilgan
      max_memory_restart: '1G',
      
      // Graceful shutdown
      kill_timeout: 5000, // 5 soniya ichida graceful shutdown
      wait_ready: false,
      listen_timeout: 10000,
      
      // Loglar
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true, // Loglarda vaqt ko'rsatish
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Restart policy
      min_uptime: '10s', // 10 soniyadan kam ishlagan bo'lsa, restart qilish
      max_restarts: 10, // Maksimal restart soni
      restart_delay: 4000, // Restart orasidagi vaqt
      
      // Advanced options
      node_args: '',
      ignore_watch: ['node_modules', 'logs', '.git'],
      
      // Source map support
      source_map_support: true,
    },
  ],
};
EOF

echo "✓ Fayl to'g'ri yaratildi"
echo ""

# Syntax tekshirish
echo "Syntax tekshirilmoqda..."
node -c ecosystem.config.cjs && echo "✓ Syntax to'g'ri" || echo "✗ Syntax xatosi"
echo ""

echo "=== Tozalash yakunlandi ==="
echo ""
echo "Endi quyidagi buyruqlarni bajaring:"
echo "  pm2 start ecosystem.config.cjs"
echo "  pm2 save"
echo "  pm2 status"

