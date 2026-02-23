# Production Deploy Yo'riqnomasi

## Muammo
Production'da "Blocked request. This host is not allowed" xatosi - Vite server production'da ishlamaydi.

## Yechim

### 1. Production Build Qilish

```bash
# 1. Dependencies o'rnatish
npm install

# 2. Production build
npm run build

# 3. Build natijasini tekshirish
ls -la dist/
```

### 2. Production Server Sozlamalari

Production'da **faqat backend server** ishlatiladi. Frontend static fayllar backend orqali serve qilinadi.

#### Backend Server (server/index.ts)

Backend server allaqachon static fayllarni serve qilish uchun sozlangan:

```typescript
// Static files (production)
app.use(express.static('dist'));

// SPA routing - barcha boshqa so'rovlarni index.html ga yo'naltirish
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});
```

### 3. Environment Variables

#### Production .env
```env
MONGODB_URI="mongodb+srv://avtofix2025_db_user:FTnjYsHxkYxgu7qH@cluster0.b2fwuli.mongodb.net/"
DB_NAME="avtofix"
BASE_URL="https://shop.avtofix.uz"
VITE_API_URL="https://shop.avtofix.uz"
API_PORT=5175
```

**MUHIM**: Production'da `VITE_API_URL` backend server URL'i bo'lishi kerak.

### 4. PM2 bilan Ishga Tushirish

```bash
# PM2 o'rnatish (agar o'rnatilmagan bo'lsa)
npm install -g pm2

# Backend serverni ishga tushirish
pm2 start ecosystem.config.cjs

# Status tekshirish
pm2 status

# Loglarni ko'rish
pm2 logs

# Qayta ishga tushirish
pm2 restart all

# To'xtatish
pm2 stop all
```

### 5. Nginx Konfiguratsiyasi (Agar Nginx ishlatilsa)

```nginx
server {
    listen 80;
    server_name shop.avtofix.uz;

    # Frontend static fayllar
    location / {
        proxy_pass http://localhost:5175;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API so'rovlari
    location /api {
        proxy_pass http://localhost:5175;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:5175;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

### 6. Deploy Qadamlari

```bash
# 1. Serverga ulanish
ssh user@shop.avtofix.uz

# 2. Loyihani yangilash
cd /path/to/AvtoFix
git pull origin main

# 3. Dependencies yangilash
npm install

# 4. Build qilish
npm run build

# 5. PM2 ni qayta ishga tushirish
pm2 restart all

# 6. Loglarni tekshirish
pm2 logs
```

### 7. Xatoliklarni Tuzatish

#### "Blocked request" xatosi
- ✅ Vite config'da `allowedHosts` qo'shilgan
- ✅ Production'da faqat backend server ishlatiladi
- ✅ Frontend static fayllar backend orqali serve qilinadi

#### "403 Forbidden" xatosi
- CORS sozlamalari to'g'ri ekanligini tekshiring
- Backend server ishga tushganligini tekshiring: `pm2 status`
- Loglarni tekshiring: `pm2 logs`

#### "Cannot GET /api/..." xatosi
- Backend server ishlamayotgan
- API_PORT to'g'ri sozlanmagan
- PM2 ni qayta ishga tushiring: `pm2 restart all`

### 8. Monitoring

```bash
# Server statusini tekshirish
pm2 status

# CPU va Memory ishlatilishini ko'rish
pm2 monit

# Loglarni real-time ko'rish
pm2 logs --lines 100

# Xatolik loglarini ko'rish
pm2 logs --err
```

### 9. Backup

```bash
# MongoDB backup
mongodump --uri="mongodb+srv://..." --out=/backup/$(date +%Y%m%d)

# Code backup
tar -czf avtofix-backup-$(date +%Y%m%d).tar.gz /path/to/AvtoFix
```

## Xulosa

Production'da:
1. ✅ Frontend build qilinadi (`npm run build`)
2. ✅ Backend server static fayllarni serve qiladi
3. ✅ Faqat bitta server (backend) ishga tushiriladi
4. ✅ PM2 orqali boshqariladi
5. ✅ Nginx reverse proxy sifatida ishlatiladi (optional)

**MUHIM**: Vite development server production'da ishlatilmaydi!
