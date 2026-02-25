/**
 * PM2 Ecosystem Configuration
 * ESM module uchun to'liq sozlangan
 */
module.exports = {
  apps: [
    {
      name: 'avtofixshop',
      script: './dist/server/node-build.mjs',
      
      // ESM module uchun sozlash
      interpreter: 'node',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 5177,  // AvtoFixShop uchun alohida port (nginx bilan mos)
        API_PORT: 5177,
      },
      
      // PM2 sozlamalari
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000,
      
      // Loglar
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Restart policy
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Advanced options
      node_args: '',
      ignore_watch: ['node_modules', 'logs', '.git'],
      source_map_support: true,
    },
  ],
};
