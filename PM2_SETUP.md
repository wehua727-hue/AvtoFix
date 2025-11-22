# PM2 Setup Qo'llanmasi

## O'rnatish

PM2 global o'rnatilgan bo'lishi kerak:

```bash
npm install -g pm2
# yoki
pnpm add -g pm2
```

## Build qilish

Avval loyihani build qiling:

```bash
pnpm run build
```

Bu quyidagilarni yaratadi:
- `dist/` - Frontend build
- `dist/server/production.mjs` - Backend server (ESM module)

## PM2 orqali ishga tushirish

### 1. Server ishga tushirish

```bash
pnpm run pm2:start
```

Yoki to'g'ridan-to'g'ri:

```bash
pm2 start ecosystem.config.cjs
```

### 2. PM2 processlarni saqlash (autostart uchun)

```bash
pnpm run pm2:save
```

Bu PM2 processlarni saqlaydi va tizim qayta ishga tushganda avtomatik ishga tushadi.

### 3. Status tekshirish

```bash
pnpm run pm2:status
# yoki
pm2 status
```

### 4. Loglarni ko'rish

```bash
pnpm run pm2:logs
# yoki
pm2 logs oflayn-dokon
```

Real-time loglar:

```bash
pm2 logs oflayn-dokon --lines 100
```

### 5. Restart qilish

```bash
pnpm run pm2:restart
# yoki
pm2 restart oflayn-dokon
```

### 6. To'xtatish

```bash
pnpm run pm2:stop
# yoki
pm2 stop oflayn-dokon
```

### 7. O'chirish

```bash
pnpm run pm2:delete
# yoki
pm2 delete oflayn-dokon
```

### 8. Monitoring

```bash
pnpm run pm2:monit
# yoki
pm2 monit
```

## Muhim Eslatmalar

1. **Port**: Server default `3000` portda ishlaydi. O'zgartirish uchun `.env` faylida `PORT=3000` ni o'zgartiring yoki `ecosystem.config.cjs` da `env.PORT` ni o'zgartiring.

2. **MongoDB**: MongoDB ulanishi `.env` faylida `MONGODB_URI` orqali sozlanadi.

3. **Loglar**: Barcha loglar `./logs/` papkasida saqlanadi:
   - `pm2-error.log` - Xatolar
   - `pm2-out.log` - Standard output
   - `pm2-combined.log` - Barcha loglar

4. **Graceful Shutdown**: Server `SIGTERM` va `SIGINT` signallarini to'g'ri qayta ishlaydi. PM2 `kill_timeout: 5000` (5 soniya) ichida graceful shutdown qiladi.

5. **Auto Restart**: Agar server 10 soniyadan kam ishlab, xatoga tushsa, PM2 avtomatik restart qiladi.

## Production Deployment

1. Build qiling:
   ```bash
   pnpm run build
   ```

2. PM2 orqali ishga tushiring:
   ```bash
   pnpm run pm2:start
   ```

3. PM2 processlarni saqlang (autostart):
   ```bash
   pnpm run pm2:save
   ```

4. PM2 startup script yarating (tizim qayta ishga tushganda avtomatik ishga tushishi uchun):
   ```bash
   pm2 startup
   ```
   Bu buyruq sizga boshqa buyruq beradi, uni root yoki sudo bilan bajarishingiz kerak.

## Troubleshooting

### Server ishlamayapti

1. Loglarni tekshiring:
   ```bash
   pm2 logs oflayn-dokon --err
   ```

2. Build fayl mavjudligini tekshiring:
   ```bash
   ls -la dist/server/production.mjs
   ```

3. Port bandligini tekshiring:
   ```bash
   netstat -ano | findstr :3000  # Windows
   lsof -i :3000                 # Linux/Mac
   ```

### MongoDB ulanmayapti

1. `.env` faylida `MONGODB_URI` to'g'ri sozlanganligini tekshiring
2. MongoDB server ishlayotganligini tekshiring
3. Loglarda MongoDB xatolarini ko'ring:
   ```bash
   pm2 logs oflayn-dokon | grep mongo
   ```

### SIGINT/SIGTERM muammosi

Agar server to'xtatilganda graceful shutdown qilmasa, `ecosystem.config.cjs` da `kill_timeout` ni oshiring:

```javascript
kill_timeout: 10000, // 10 soniyaga oshirildi
```

