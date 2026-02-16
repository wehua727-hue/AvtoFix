# 🚀 VPS Deploy Yo'riqnomasi

## 📋 Deploy Qilish Bosqichlari

### 1. **Git Push**
```bash
# Barcha o'zgarishlarni commit qiling
git add .
git commit -m "fix: mahsulot o'chirish funksiyasi tuzatildi"
git push origin main
```

### 2. **VPS'ga Kirish**
```bash
ssh root@your-vps-ip
# yoki
ssh user@shop.avtofix.uz
```

### 3. **Loyihani Yangilash**
```bash
# Loyiha papkasiga o'tish
cd /path/to/AvtoFix

# Git pull
git pull origin main

# Dependencies o'rnatish (agar kerak bo'lsa)
pnpm install

# Build qilish
pnpm run build
```

### 4. **Backend'ni Qayta Ishga Tushirish**
```bash
# PM2 bilan
pm2 restart avtofix-api

# yoki
pm2 restart all

# Loglarni ko'rish
pm2 logs avtofix-api
```

### 5. **Frontend'ni Yangilash**
```bash
# Agar static files bo'lsa
# Build papkasini nginx ga ko'chirish
cp -r dist/* /var/www/shop.avtofix.uz/

# Nginx ni qayta yuklash
sudo systemctl reload nginx
```

---

## 🔍 Muammolarni Tekshirish

### Backend Loglarni Ko'rish
```bash
# PM2 logs
pm2 logs avtofix-api --lines 100

# yoki to'g'ridan-to'g'ri
tail -f /path/to/logs/api.log
```

### Backend Ishlayotganini Tekshirish
```bash
# API ni test qilish
curl https://shop.avtofix.uz/api/products

# yoki
curl http://localhost:5175/api/products
```

### Database Ulanishini Tekshirish
```bash
# MongoDB ishlayotganini tekshirish
sudo systemctl status mongod

# MongoDB ga kirish
mongosh

# Database ni tanlash
use oflayn-dokon

# Mahsulotlar sonini ko'rish
db.products.countDocuments()
```

---

## ⚠️ Agar Deploy Qilishda Muammo Bo'lsa

### 1. **Build Xatosi**
```bash
# Node modules ni tozalash
rm -rf node_modules
pnpm install

# Cache ni tozalash
pnpm run clean
pnpm run build
```

### 2. **PM2 Xatosi**
```bash
# PM2 ni to'liq qayta ishga tushirish
pm2 delete all
pm2 start ecosystem.config.js

# yoki
pm2 start server/index.js --name avtofix-api
```

### 3. **Port Band Bo'lsa**
```bash
# Port ishlatilayotganini tekshirish
lsof -i :5175

# Process ni to'xtatish
kill -9 <PID>
```

### 4. **Nginx Xatosi**
```bash
# Nginx konfiguratsiyasini tekshirish
sudo nginx -t

# Nginx ni qayta ishga tushirish
sudo systemctl restart nginx

# Nginx loglarni ko'rish
sudo tail -f /var/log/nginx/error.log
```

---

## 🔧 Tezkor Deploy (Quick Deploy)

Agar faqat backend o'zgargan bo'lsa:

```bash
# VPS'da
cd /path/to/AvtoFix
git pull
pm2 restart avtofix-api
pm2 logs avtofix-api
```

Agar faqat frontend o'zgargan bo'lsa:

```bash
# Local'da
pnpm run build

# VPS'ga yuklash (scp yoki rsync)
scp -r dist/* user@shop.avtofix.uz:/var/www/shop.avtofix.uz/
```

---

## 📝 Muhim Eslatmalar

1. **Backup** - Deploy qilishdan oldin database backup oling:
   ```bash
   mongodump --db oflayn-dokon --out /backup/$(date +%Y%m%d)
   ```

2. **Environment Variables** - `.env` faylni tekshiring:
   ```bash
   cat .env
   ```

3. **Permissions** - Fayl ruxsatlarini tekshiring:
   ```bash
   chmod -R 755 /path/to/AvtoFix
   chown -R www-data:www-data /var/www/shop.avtofix.uz
   ```

4. **SSL Certificate** - Agar HTTPS ishlamasa:
   ```bash
   sudo certbot renew
   sudo systemctl reload nginx
   ```

---

## 🚨 Hozirgi Muammo: DELETE API 500 Error

**Sabab:** Frontend DELETE so'rovida `body` yuborilmagan, backend esa `userRole` va `canEditProducts` ni kutayapti.

**Yechim:**
```bash
# 1. Local'da build qilish
cd AvtoFix
npm run build

# 2. Git commit va push
git add .
git commit -m "fix: DELETE so'roviga userRole va canEditProducts qo'shildi"
git push origin main

# 3. VPS'ga kirish
ssh user@shop.avtofix.uz

# 4. Loyihani yangilash
cd /path/to/AvtoFix
git pull origin main

# 5. Frontend build qilish (agar kerak bo'lsa)
npm run build

# 6. Frontend fayllarini nginx ga ko'chirish
cp -r dist/* /var/www/shop.avtofix.uz/

# 7. Nginx ni qayta yuklash
sudo systemctl reload nginx
```

**Test qilish:**
1. https://shop.avtofix.uz ga kiring
2. Mahsulotlar → "Tozalash" → "Kod Bo'yicha Tozalash"
3. Min: 10, Max: 20 → "O'chirish"
4. Mahsulotlar o'chiriladi va qaytib kelmaydi ✅

**Batafsil ma'lumot:** `FIX-DELETE-ISSUE.md` faylini o'qing.

---

**Yaratilgan:** 2025-02-16
**Versiya:** 1.0.0
