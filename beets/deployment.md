# 🚀 DEPLOYMENT - Production ga Chiqarish

## 📋 Umumiy Ma'lumot

**Server:** WPS Hosting / VPS

**Domain:** shop.avtofix.uz

**Stack:** Nginx + PM2 + MongoDB

---

## 🔧 Development

### Ishga Tushirish:
```bash
# Dependencies o'rnatish
pnpm install

# Development server
pnpm run dev

# Frontend: http://localhost:5174
# Backend: http://localhost:5175
```

---

## 📦 Production Build

### Build Qilish:
```bash
# Frontend va Backend build
pnpm run build

# Faqat Frontend
pnpm run build:client

# Faqat Backend
pnpm run build:server
```

### Build Natijasi:
```
dist/
├── client/     # Frontend static files
└── server/     # Backend compiled files
```

---

## 🌐 Nginx Konfiguratsiyasi

```nginx
server {
    listen 80;
    server_name shop.avtofix.uz;
    
    # Frontend
    location / {
        root /var/www/avtofix/dist/client;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
    }
    
    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

---

## 🔄 PM2 Konfiguratsiyasi

### ecosystem.config.cjs:
```javascript
module.exports = {
  apps: [{
    name: 'avtofix',
    script: './dist/server/production.mjs',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5173,
    }
  }]
};
```

### PM2 Komandalar:
```bash
# Ishga tushirish
pm2 start ecosystem.config.cjs

# To'xtatish
pm2 stop avtofix

# Qayta ishga tushirish
pm2 restart avtofix

# Loglarni ko'rish
pm2 logs avtofix

# Holat
pm2 status
```

---

## 🗄️ MongoDB

### Connection String:
```
mongodb://localhost:27017/avtofix
# yoki
mongodb+srv://user:pass@cluster.mongodb.net/avtofix
```

### Backup:
```bash
# Backup yaratish
mongodump --db avtofix --out /backup/$(date +%Y%m%d)

# Restore qilish
mongorestore --db avtofix /backup/20250210
```

---

## 🔐 Environment Variables

### .env.production:
```env
NODE_ENV=production
PORT=5173
MONGODB_URI=mongodb://localhost:27017/avtofix
JWT_SECRET=your-secret-key
TELEGRAM_BOT_TOKEN=your-bot-token
VITE_API_URL=https://shop.avtofix.uz
```

---

## 📱 Electron Desktop App

### Build Qilish:
```bash
# Windows
pnpm run electron:build:win

# macOS
pnpm run electron:build:mac

# Linux
pnpm run electron:build:linux
```

### Natija:
```
dist-electron/
├── AvtoFix Setup 1.0.0.exe  (Windows)
├── AvtoFix-1.0.0.dmg        (macOS)
└── AvtoFix-1.0.0.AppImage   (Linux)
```

---

## ✅ Deployment Checklist

- [ ] Code push qilindi (Git)
- [ ] Dependencies o'rnatildi
- [ ] Build qilindi
- [ ] .env.production sozlandi
- [ ] MongoDB backup olindi
- [ ] Nginx konfiguratsiyasi yangilandi
- [ ] PM2 process ishga tushirildi
- [ ] SSL sertifikat o'rnatildi (Let's Encrypt)
- [ ] Domain DNS sozlandi
- [ ] Firewall sozlandi
- [ ] Monitoring o'rnatildi

---

## 🔍 Monitoring

### PM2 Monitoring:
```bash
pm2 monit
```

### Nginx Logs:
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Application Logs:
```bash
pm2 logs avtofix --lines 100
```

---

## 🆘 Troubleshooting

### 502 Bad Gateway:
- PM2 process ishlamoqdami? `pm2 status`
- Port to'g'rimi? `netstat -tlnp | grep 5173`
- Nginx konfiguratsiya to'g'rimi? `nginx -t`

### MongoDB Connection Error:
- MongoDB ishlamoqdami? `systemctl status mongod`
- Connection string to'g'rimi?
- Firewall ochiqmi?

---

**Yaratilgan:** 2025-02-10
