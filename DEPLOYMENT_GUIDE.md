# 🚀 Production Deployment Qo'llanmasi

## 🔧 Muammo va Tuzatish

### Muammo: 502 Bad Gateway
```
WebSocket connection to 'wss://shop.avtofix.uz/ws' failed
Failed to load resource: the server responded with a status of 502
```

### Sababi:
1. **Nginx port noto'g'ri** - 5174 ga proxy qilmoqda, lekin server 5173 da ishlayapti
2. **WebSocket URL noto'g'ri** - Frontend `wss://shop.avtofix.uz/ws` ga ulanmoqda
3. **API URL noto'g'ri** - Frontend `shop.avtofix.uz/api` ga ulanmoqda

---

## ✅ Tuzatish Qadamlari

### 1. Nginx Konfiguratsiyasini Yangilash

```bash
# Yangi konfiguratsiyani ko'chirish
sudo cp nginx-config-fixed.conf /etc/nginx/sites-available/shop.avtofix.uz

# Nginx test qilish
sudo nginx -t

# Nginx qayta ishga tushirish
sudo systemctl restart nginx
```

### 2. PM2 Konfiguratsiyasini Tekshirish

```bash
# Hozirgi PM2 processlarni ko'rish
pm2 list

# Agar process ishlamoqda bo'lsa, o'chirish
pm2 delete oflayn-dokon
pm2 delete avtofix

# Yangi konfiguratsiya bilan ishga tushirish
pm2 start ecosystem.config.cjs

# PM2 saqlash
pm2 save
```

### 3. Environment Variables Tekshirish

```bash
# Production .env faylini tekshirish
cat .env.production

# Quyidagilar bo'lishi kerak:
# PORT=5173
# VITE_API_URL="https://shop.avtofix.uz"
# NODE_ENV="production"
```

### 4. Build Qilish

```bash
# Frontend va backend build qilish
pnpm run build

# Build natijasini tekshirish
ls -la dist/
```

### 5. Server Ishlamoqda Ekanligini Tekshirish

```bash
# Health check
curl http://127.0.0.1:5173/api/health

# Javob bo'lishi kerak:
# {"status":"ok"}
```

### 6. Nginx Logs Tekshirish

```bash
# Error logs
sudo tail -f /var/log/nginx/error.log

# Access logs
sudo tail -f /var/log/nginx/access.log
```

---

## 📋 Nginx Konfiguratsiyasi (Asosiy O'zgartirishlar)

### Eski (Noto'g'ri):
```nginx
location /api {
    proxy_pass http://127.0.0.1:5174;  # ❌ NOTO'G'RI PORT
}

location /ws {
    proxy_pass http://127.0.0.1:5174;  # ❌ NOTO'G'RI PORT
}
```

### Yangi (To'g'ri):
```nginx
location /api {
    proxy_pass http://127.0.0.1:5173;  # ✅ TO'G'RI PORT
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
}

location /ws {
    proxy_pass http://127.0.0.1:5173;  # ✅ TO'G'RI PORT
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_read_timeout 86400s;
}
```

---

## 🔍 Tekshirish Checklist

- [ ] Nginx konfiguratsiyasi yangilandi
- [ ] PM2 process 5173 portda ishlamoqda
- [ ] `.env.production` da `VITE_API_URL="https://shop.avtofix.uz"`
- [ ] Build qilindi: `pnpm run build`
- [ ] Health check ishlayapti: `curl http://127.0.0.1:5173/api/health`
- [ ] Nginx qayta ishga tushirildi: `sudo systemctl restart nginx`
- [ ] Browser cache tozalandi (Ctrl+Shift+Delete)
- [ ] Login qilish ishlayapti

---

## 🚨 Agar Hali Muammo Bo'lsa

### 1. PM2 Logs Tekshirish
```bash
pm2 logs oflayn-dokon
```

### 2. Nginx Logs Tekshirish
```bash
sudo tail -100 /var/log/nginx/error.log
```

### 3. Port Tekshirish
```bash
# 5173 portda process ishlamoqda ekanligini tekshirish
netstat -tlnp | grep 5173
# yoki
lsof -i :5173
```

### 4. Firewall Tekshirish
```bash
# Agar firewall ishlamoqda bo'lsa
sudo ufw allow 5173
sudo ufw allow 80
sudo ufw allow 443
```

### 5. MongoDB Ulanishini Tekshirish
```bash
# PM2 logs da MongoDB xatosini ko'rish
pm2 logs oflayn-dokon | grep -i mongo
```

---

## 📝 Deployment Checklist

### Pre-Deployment
- [ ] Barcha o'zgartirishlar GitHub da push qilindi
- [ ] `.env.production` yangilandi
- [ ] `ecosystem.config.cjs` yangilandi
- [ ] `nginx-config-fixed.conf` yangilandi

### Deployment
- [ ] Server ga SSH orqali ulanildi
- [ ] Repository pull qilindi: `git pull origin main`
- [ ] Dependencies o'rnatildi: `pnpm install`
- [ ] Build qilindi: `pnpm run build`
- [ ] Nginx konfiguratsiyasi yangilandi
- [ ] PM2 process qayta ishga tushirildi

### Post-Deployment
- [ ] Health check ishlayapti
- [ ] Login qilish ishlayapti
- [ ] WebSocket ulanishi ishlayapti
- [ ] API chaqiruvlari ishlayapti
- [ ] Logs tekshirildi

---

## 🎯 Keyingi Qadamlar

1. ✅ Nginx konfiguratsiyasini yangilash
2. ✅ PM2 processni qayta ishga tushirish
3. ✅ Browser cache tozalash
4. ✅ Login qilishni sinab ko'rish
5. ✅ Mahsulotlarni qo'shishni sinab ko'rish

---

**Deployment muvaffaqiyatli bo'lishini tilaymiz! 🚀**
