# VPS Backend Muammosi - Diagnostika

## Muammo
VPSda mahsulotlarni o'chirishda 500 xatolik:
```
DELETE https://shop.avtofix.uz/api/products/[id] 500 (Internal Server Error)
```

## Sabab
Frontend yangi kod (min/max o'chirish ko'rinadi), lekin backend eski kod (history logging yo'q).

## Tekshirish

### 1. VPSga ulanish
```bash
ssh user@shop.avtofix.uz
```

### 2. Backend kodini tekshirish
```bash
cd /path/to/AvtoFix
git log -1 --oneline
git status
```

### 3. Backend loglarini ko'rish
```bash
pm2 logs avtofix-api --lines 50
```

Qidirilayotgan xatolik:
- `TypeError: Cannot read property 'variantSummaries' of null`
- `ReferenceError: PRODUCT_HISTORY_COLLECTION is not defined`
- Boshqa xatoliklar

### 4. Yangi kodning mavjudligini tekshirish
```bash
cd /path/to/AvtoFix
grep -n "PRODUCT_HISTORY_COLLECTION" server/routes/products.ts
grep -n "O'chirishdan OLDIN tarixga yozish" server/routes/products.ts
```

Agar bu qatorlar topilmasa - backend eski kod.

## Yechim

### Variant 1: Git Pull (Tavsiya etiladi)
```bash
cd /path/to/AvtoFix
git pull origin main
npm install  # Agar yangi dependencies bo'lsa
pm2 restart avtofix-api
pm2 logs avtofix-api --lines 20
```

### Variant 2: Manual Deploy
Agar git pull ishlamasa:

1. Lokalda build qilish:
```bash
cd AvtoFix
npm run build
```

2. Build fayllarini VPSga yuklash:
```bash
scp -r dist/ user@shop.avtofix.uz:/path/to/AvtoFix/
scp -r server/ user@shop.avtofix.uz:/path/to/AvtoFix/
```

3. VPSda restart:
```bash
ssh user@shop.avtofix.uz
cd /path/to/AvtoFix
pm2 restart avtofix-api
```

### Variant 3: Faqat Backend Faylini Almashtirish
```bash
# Lokalda
scp AvtoFix/server/routes/products.ts user@shop.avtofix.uz:/path/to/AvtoFix/server/routes/

# VPSda
ssh user@shop.avtofix.uz
cd /path/to/AvtoFix
pm2 restart avtofix-api
```

## Tekshirish (Deploy dan keyin)

### 1. Backend loglarini ko'rish
```bash
pm2 logs avtofix-api --lines 20
```

Kutilayotgan log:
```
[api/products/:id DELETE] Deleting product: [id]
[api/products/:id DELETE] Found product: [name]
[api/products/:id DELETE] History saved for product: [name]
[api/products/:id DELETE] ✅ Product deleted successfully: [id]
```

### 2. Frontend orqali test qilish
1. https://shop.avtofix.uz ga kiring
2. Mahsulotlar sahifasiga o'ting
3. "Tozalash" tugmasini bosing
4. "Kod Bo'yicha Tozalash" ni tanlang
5. Min: 10, Max: 20 kiriting
6. "O'chirish" ni bosing

Kutilayotgan natija:
- ✅ Mahsulotlar o'chiriladi
- ✅ Sahifa yangilanadi
- ✅ Console da xatolik yo'q

### 3. Database tekshirish
```bash
# MongoDB ga ulanish
mongosh "mongodb://localhost:27017/avtofix"

# History collection ni tekshirish
db.product_history.find({ type: 'delete' }).sort({ createdAt: -1 }).limit(5)
```

Kutilayotgan natija:
- O'chirilgan mahsulotlar history da saqlanadi
- `type: 'delete'` bo'ladi
- `variants` array mavjud bo'ladi (agar xillar bo'lsa)

## Xatoliklarni Tuzatish

### Xatolik: "pm2: command not found"
```bash
npm install -g pm2
```

### Xatolik: "Permission denied"
```bash
sudo pm2 restart avtofix-api
```

### Xatolik: Backend ishlamayapti
```bash
pm2 list
pm2 start ecosystem.config.js  # Agar to'xtatilgan bo'lsa
```

### Xatolik: Port band
```bash
lsof -i :3000  # Backend port
kill -9 [PID]  # Agar kerak bo'lsa
pm2 restart avtofix-api
```

## Qo'shimcha Ma'lumot

### Backend Kod Versiyasi
Yangi kod (kerakli):
- `PRODUCT_HISTORY_COLLECTION` o'zgaruvchisi mavjud
- `handleProductDelete` da history logging bor
- Variantlar ota mahsulot bilan o'chiriladi

Eski kod (muammoli):
- History logging yo'q
- Variantlar ota mahsulotga aylanadi
- 500 xatolik qaytaradi

### Frontend Kod Versiyasi
Yangi kod (hozirgi):
- "Kod Bo'yicha Tozalash" dialog mavjud
- Min/Max input bor
- DELETE so'rovlari to'g'ri yuboriladi

## Xulosa
Frontend yangi, backend eski. Backend ni yangilash kerak.
