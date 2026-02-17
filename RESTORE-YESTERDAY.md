# Kechagi Soat 17:00 dagi Mahsulotlarni Qaytarish

## 📋 Qisqa Yo'riqnoma

Kechagi (2025-02-16) soat 17:00-17:59 oralig'idagi o'chirilgan mahsulotlarni qaytarish uchun:

### 1. Terminal Ochish
```bash
cd AvtoFix
```

### 2. Script Ishga Tushirish
```bash
npx tsx scripts/restore-yesterday-17.ts
```

### 3. Natijani Ko'rish
Script avtomatik ishlaydi va quyidagi ma'lumotlarni ko'rsatadi:
- Topilgan mahsulotlar soni
- Har bir mahsulotning nomi, SKU, stock, narx
- Xillar (agar bo'lsa)
- Qaytarilgan mahsulotlar soni

## 📊 Kutilayotgan Natija

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

2. MAZ zapchasti (SKU: 16)
   O'chirilgan vaqt: 16.02.2025, 17:24:12
   Stock: 8
   Narx: 45000 UZS

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

## ⚠️ Agar Mahsulotlar Topilmasa

Agar script "Mahsulotlar topilmadi" deb ko'rsatsa:

```
❌ Kechagi kunning soat 17:00 da o'chirilgan mahsulotlar topilmadi

💡 Ehtimol:
   1. O'chirilgan mahsulotlar history ga saqlanmagan
   2. Vaqt zonasi noto'g'ri (UTC vs Asia/Tashkent)
   3. Backend eski kod ishlagan va history yozmagan

🔍 Barcha o'chirilgan mahsulotlar (oxirgi 10 ta):
   1. Test mahsulot (SKU: 100)
      O'chirilgan: 17.02.2025, 10:30:00
   2. ...
```

Bu holda:

### Variant 1: Boshqa Vaqtni Tekshirish
Agar ro'yxatda mahsulotlar ko'rinsa, ularning vaqtini ko'ring va to'g'ri vaqtni kiriting:

```bash
npx tsx scripts/restore-products-by-time.ts
```

Keyin:
```
Foydalanuvchi ID: 697746478dc86ae74f75ad07
Sana (YYYY-MM-DD): 2025-02-16
Soat (0-23): 17
```

### Variant 2: Barcha O'chirilganlarni Ko'rish
```bash
npx tsx scripts/restore-deleted-products.ts
```

Bu barcha o'chirilgan mahsulotlarni ko'rsatadi va qaysi birini qaytarishni tanlash imkonini beradi.

### Variant 3: Database Tekshirish
```bash
npx tsx scripts/check-database.ts
```

Bu database holatini ko'rsatadi va history mavjudligini tekshiradi.

## 🔧 Muammolarni Hal Qilish

### Muammo 1: "MongoDB ga ulanmadi"
**Yechim:**
```bash
# MongoDB ni ishga tushirish
sudo systemctl start mongod

# Statusni tekshirish
sudo systemctl status mongod
```

### Muammo 2: "tsx: command not found"
**Yechim:**
```bash
# Dependencies o'rnatish
npm install
```

### Muammo 3: "History bo'sh"
**Sabab:** Backend eski kod ishlagan va o'chirilgan mahsulotlar history ga saqlanmagan.

**Yechim:**
1. Backend kodini yangilash (DEPLOY.md ga qarang)
2. Keyingi o'chirishlar history ga yoziladi
3. Eski mahsulotlarni qaytarib bo'lmaydi (backup yo'q bo'lsa)

### Muammo 4: "Mahsulot allaqachon mavjud"
Bu xatolik emas - mahsulot allaqachon qaytarilgan yoki o'chirilmagan.

Script avtomatik o'tkazib yuboradi va keyingisiga o'tadi.

## 📝 Qo'shimcha Ma'lumot

### Vaqt Zonasi
- Script UTC vaqtini ishlatadi
- Toshkent vaqti UTC+5
- Agar Toshkent 17:00 bo'lsa, UTC 12:00

### Dublikat Tekshiruvi
Script SKU bo'yicha dublikat tekshiradi:
- Agar mahsulot allaqachon mavjud bo'lsa → o'tkazib yuboriladi
- Agar mahsulot yo'q bo'lsa → qaytariladi

### Xillar
Agar mahsulotda xillar bo'lsa, ular ham qaytariladi:
- Xil nomi
- Xil SKU
- Xil stock
- Xil narx

### Foydalanuvchi ID
Script faqat 910712828 (ID: 697746478dc86ae74f75ad07) uchun ishlaydi.

Agar boshqa foydalanuvchi uchun kerak bo'lsa:
```bash
npx tsx scripts/restore-products-by-time.ts
```

## ✅ Muvaffaqiyatli Qaytarish

Agar script muvaffaqiyatli ishlasa:

1. **Mahsulotlar qaytariladi** - products collection ga qo'shiladi
2. **Xillar qaytariladi** - variantSummaries bilan birga
3. **Stock qaytariladi** - eski stock qiymati bilan
4. **Narx qaytariladi** - eski narx qiymati bilan

Keyin:
1. https://shop.avtofix.uz ga kiring
2. Mahsulotlar sahifasiga o'ting
3. Qaytarilgan mahsulotlarni ko'ring

---

**Yaratilgan:** 2025-02-17
**Versiya:** 1.0.0
