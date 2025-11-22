# 502 Bad Gateway Xatosini Tuzatish

## Muammo
Production'da `https://shop.avtofix.uz/api/products` ga so'rov yuborilganda 502 Bad Gateway xatosi kelmoqda.

## Yechimlar

### 1. Backend Serverni Tekshirish

Server ishlayotganligini tekshiring:

```bash
# PM2 status
pm2 status

# PM2 loglarni ko'rish
pm2 logs oflayn-dokon

# Agar server ishlamasa, qayta ishga tushiring
pm2 restart oflayn-dokon
```

### 2. Portni Tekshirish

Backend server 5173 portda ishlashi kerak. Tekshiring:

```bash
# Port bandligini tekshirish
netstat -tulpn | grep 5173
# yoki
lsof -i :5173
```

### 3. Build Qilish

Agar server ishlamasa, qayta build qiling:

```bash
# Build qilish
pnpm run build

# PM2 orqali ishga tushirish
pnpm run pm2:start
# yoki
pm2 start ecosystem.config.cjs
```

### 4. Nginx/Reverse Proxy Sozlash

Agar Nginx ishlatayotgan bo'lsangiz, quyidagicha sozlash kerak:

```nginx
server {
    listen 80;
    server_name shop.avtofix.uz;

    # Frontend uchun
    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API uchun
    location /api {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads uchun
    location /uploads {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. Environment Variables

`.env` faylida quyidagilar bo'lishi kerak:

```env
NODE_ENV=production
PORT=5173
MONGODB_URI=your_mongodb_uri
DB_NAME=your_db_name
```

### 6. PM2 Autostart

Server tizim qayta ishga tushganda avtomatik ishga tushishi uchun:

```bash
# PM2 processlarni saqlash
pm2 save

# PM2 startup script yaratish
pm2 startup
# Bu sizga buyruq beradi, uni root yoki sudo bilan bajarishingiz kerak
```

### 7. Firewall Sozlash

Agar firewall ishlatayotgan bo'lsangiz, 5173 portni oching:

```bash
# UFW uchun
sudo ufw allow 5173

# yoki firewalld uchun
sudo firewall-cmd --permanent --add-port=5173/tcp
sudo firewall-cmd --reload
```

### 8. Debug Qilish

Agar hali ham muammo bo'lsa:

```bash
# PM2 loglarni real-time ko'rish
pm2 logs oflayn-dokon --lines 100

# Server to'g'ridan-to'g'ri ishga tushirish (PM2 o'rniga)
cd /path/to/project
node dist/server/production.mjs

# Bu xatolarni ko'rsatadi
```

## Tekshirish

Server ishlayotganligini tekshirish:

```bash
# Local'da
curl http://localhost:5173/api/health

# Production'da
curl https://shop.avtofix.uz/api/health
```

Agar `{"status":"ok"}` qaytsa, server ishlayapti.

## Qo'shimcha Eslatmalar

1. **Backend va Frontend bitta portda**: Backend server 5173 portda ishlaydi va frontend'ni ham serve qiladi.
2. **PM2 ishlatish**: Production'da har doim PM2 orqali ishga tushiring.
3. **Loglarni kuzatish**: `pm2 logs` orqali xatolarni kuzatib boring.
4. **Auto restart**: PM2 avtomatik restart qiladi, agar server xatoga tushsa.

