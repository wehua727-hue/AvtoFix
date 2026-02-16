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
