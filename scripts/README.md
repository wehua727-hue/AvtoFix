# 🔧 Scripts - Yordamchi Scriptlar

## 📋 Mavjud Scriptlar

### 1. **restore-deleted-products.ts** - O'chirilgan Mahsulotlarni Qaytarish

O'chirilgan mahsulotlarni MongoDB'dan qaytarish uchun script.

#### Ishga Tushirish:

```bash
# AvtoFix papkasida
npx tsx scripts/restore-deleted-products.ts
```

#### Qanday Ishlaydi:

1. **MongoDB'ga ulanish** - `product_history` collection'dan o'chirilgan mahsulotlarni topadi
2. **Ro'yxat ko'rsatish** - Barcha o'chirilgan mahsulotlar ro'yxatini ko'rsatadi
3. **Tasdiqlash** - Foydalanuvchidan tasdiqlash so'raydi
4. **Qaytarish** - Mahsulotlarni `products` collection'ga qaytaradi
5. **Tarixga yozish** - Qaytarish amalini tarixga yozadi

#### Misol:

```
🔄 O'chirilgan mahsulotlarni qaytarish scripti

✅ MongoDB ga ulandi

Foydalanuvchi ID ni kiriting (yoki Enter - barcha foydalanuvchilar): 

📋 Jami 15 ta o'chirilgan mahsulot topildi:

1. Moy 5W-30 1L (Kod: 10)
   Sana: 11.02.2025, 14:30:25
   Stock: 100, Narx: 50000 UZS
   Variantlar: 3 ta

2. Moy 5W-30 4L (Kod: 11)
   Sana: 11.02.2025, 14:30:26
   Stock: 50, Narx: 180000 UZS

...

Barcha mahsulotlarni qaytarishni xohlaysizmi? (ha/yo'q): ha

🔄 Mahsulotlarni qaytarish boshlandi...

✅ Moy 5W-30 1L (10) - qaytarildi
✅ Moy 5W-30 4L (11) - qaytarildi
⚠️  Moy 10W-40 (15) - allaqachon mavjud, o'tkazib yuborildi

✅ Jarayon tugadi!
   Qaytarildi: 13 ta
   O'tkazib yuborildi: 2 ta
```

#### Xususiyatlar:

- ✅ Foydalanuvchi ID bo'yicha filtrlash
- ✅ Barcha o'chirilgan mahsulotlarni ko'rsatish
- ✅ Tasdiqlash dialogi
- ✅ Dublikat tekshiruvi (SKU bo'yicha)
- ✅ Variantlar bilan qaytarish
- ✅ Tarixga yozish
- ✅ Xatoliklarni boshqarish

#### Muhim Eslatmalar:

1. **Backup** - Scriptni ishga tushirishdan oldin MongoDB backup oling
2. **Dublikat** - Agar mahsulot allaqachon mavjud bo'lsa, o'tkazib yuboriladi
3. **Variantlar** - Variantlar ham qaytariladi
4. **Tarix** - Qaytarish amali tarixga yoziladi

---

## 🔐 Environment Variables

Scriptlar uchun kerakli environment variables:

```env
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB_NAME=oflayn-dokon
```

---

## 📝 Yangi Script Qo'shish

Yangi script qo'shish uchun:

1. `scripts/` papkasida yangi `.ts` fayl yarating
2. Script kodini yozing
3. `README.md` ga qo'shing
4. `npx tsx scripts/your-script.ts` orqali ishga tushiring

---

**Yaratilgan:** 2025-02-11
**Versiya:** 1.0.0


---

### 2. **restore-yesterday-17.ts** - Kechagi Soat 17:00 dagi Mahsulotlar

Kechagi kunning soat 17:00-17:59 oralig'idagi o'chirilgan mahsulotlarni qaytarish.

#### Ishga Tushirish:

```bash
# AvtoFix papkasida
npx tsx scripts/restore-yesterday-17.ts
```

#### Qanday Ishlaydi:

1. **Vaqt hisoblash** - Kechagi kunning soat 17:00-17:59 oralig'ini aniqlaydi
2. **Qidirish** - Shu vaqt oralig'idagi o'chirilgan mahsulotlarni topadi
3. **Ro'yxat** - Topilgan mahsulotlarni ko'rsatadi
4. **Qaytarish** - Mahsulotlarni avtomatik qaytaradi (tasdiqlashsiz)

#### Misol:

```
========================================
Kechagi Kunning Soat 17:00 dagi Mahsulotlarni Qaytarish
========================================

✅ MongoDB ga ulandi

🔍 Qidirilayotgan vaqt oralig'i:
   Sana: 2025-02-16 (kecha)
   Boshlanish: 16.02.2025, 17:00:00
   Tugash: 16.02.2025, 17:59:59

✅ 15 ta o'chirilgan mahsulot topildi:

1. KAMAZ zapchasti (SKU: 15)
   O'chirilgan vaqt: 16.02.2025, 17:23:45
   Stock: 10
   Narx: 50000 UZS
   Xillar: 2 ta
      1. Kichik (SKU: 15-1, Stock: 5)
      2. Katta (SKU: 15-2, Stock: 5)

...

🔄 Mahsulotlar qaytarilmoqda...

✅ Qaytarildi: KAMAZ zapchasti (SKU: 15)
✅ Qaytarildi: MAZ zapchasti (SKU: 16)
...

========================================
✅ Jami qaytarildi: 15 ta
⚠️  O'tkazib yuborildi: 0 ta
========================================
```

#### Xususiyatlar:

- ✅ Avtomatik vaqt hisoblash (kechagi kun)
- ✅ Soat 17:00-17:59 oralig'i
- ✅ Foydalanuvchi ID: 697746478dc86ae74f75ad07 (910712828)
- ✅ Xillar bilan qaytarish
- ✅ Dublikat tekshiruvi
- ✅ Debug ma'lumotlari (agar topilmasa)

#### Muhim:

- Agar mahsulotlar topilmasa, barcha o'chirilgan mahsulotlarni ko'rsatadi (debug)
- Vaqt zonasi: UTC (Toshkent UTC+5)

---

### 3. **restore-products-by-time.ts** - Istalgan Vaqt Bo'yicha

Istalgan sana va soatdagi o'chirilgan mahsulotlarni qaytarish (interaktiv).

#### Ishga Tushirish:

```bash
# AvtoFix papkasida
npx tsx scripts/restore-products-by-time.ts
```

#### Qanday Ishlaydi:

1. **Foydalanuvchi ID** - So'raydi
2. **Sana** - YYYY-MM-DD formatida so'raydi
3. **Soat** - 0-23 oralig'ida so'raydi
4. **Tasdiqlash** - Mahsulotlarni ko'rsatadi va tasdiqlash so'raydi
5. **Qaytarish** - Tasdiqlangandan keyin qaytaradi

#### Misol:

```
Foydalanuvchi ID sini kiriting: 697746478dc86ae74f75ad07
Sanani kiriting (YYYY-MM-DD): 2025-02-16
Soatni kiriting (0-23): 17

🔍 Qidirilayotgan vaqt oralig'i:
   Boshlanish: 16.02.2025, 17:00:00
   Tugash: 16.02.2025, 17:59:59

✅ 15 ta o'chirilgan mahsulot topildi:
...

Bu mahsulotlarni qaytarishni xohlaysizmi? (ha/yo'q): ha

✅ Jami qaytarildi: 15 ta
```

---

### 4. **check-database.ts** - Database Tekshirish

Database holatini tekshirish va statistika ko'rsatish.

#### Ishga Tushirish:

```bash
# AvtoFix papkasida
npx tsx scripts/check-database.ts
```

#### Ko'rsatiladigan Ma'lumotlar:

- Mahsulotlar soni
- Kategoriyalar soni
- History soni
- O'chirilgan mahsulotlar soni
- Oxirgi 5 ta o'chirilgan mahsulot

---

## ⚠️ Muhim Eslatmalar

### 1. History Mavjudligi
Mahsulotlarni qaytarish faqat `product_history` collection da ma'lumot bo'lsa ishlaydi. Agar backend eski kod ishlagan bo'lsa, history bo'sh bo'lishi mumkin.

### 2. Vaqt Zonasi
Scriptlar UTC vaqtini ishlatadi. Toshkent vaqti UTC+5:
- Toshkent 17:00 = UTC 12:00
- Agar script topilmasa, vaqt zonasini tekshiring

### 3. Dublikat Tekshiruvi
Scriptlar SKU bo'yicha dublikat tekshiradi. Agar mahsulot allaqachon mavjud bo'lsa, o'tkazib yuboriladi.

### 4. Xillar
Agar mahsulotda xillar bo'lsa, ular ham qaytariladi.

---

## 🔧 Muammolarni Hal Qilish

### Muammo: "History bo'sh"
**Sabab:** Backend eski kod ishlagan va history yozmagan.

**Yechim:**
1. Backend kodini yangilash (DEPLOY.md ga qarang)
2. Keyingi o'chirishlar history ga yoziladi
3. Eski mahsulotlarni qaytarib bo'lmaydi (backup yo'q)

### Muammo: "Mahsulotlar topilmadi"
**Sabab:** Vaqt zonasi noto'g'ri yoki noto'g'ri sana.

**Yechim:**
1. `check-database.ts` ni ishga tushiring
2. Barcha o'chirilgan mahsulotlarni ko'ring
3. To'g'ri sana va soatni aniqlang

### Muammo: "MongoDB ga ulanmadi"
**Sabab:** MongoDB ishlamayapti yoki MONGO_URI noto'g'ri.

**Yechim:**
```bash
# MongoDB ni ishga tushirish
sudo systemctl start mongod

# Yoki .env faylda MONGO_URI ni tekshirish
cat .env | grep MONGO_URI
```

---

**Yangilangan:** 2025-02-17
**Versiya:** 1.1.0
