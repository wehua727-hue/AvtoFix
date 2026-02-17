# Kechagi Mahsulotlarni Qaytarish - Barcha Yo'llar

## ❌ Asosiy Muammo

`product_history` collection bo'sh - o'chirilgan mahsulotlar saqlanmagan.

## 🔍 Mumkin Bo'lgan Yo'llar

### 1. ✅ VPS Database Tekshirish (ENG KUCHLI YO'L)

Ehtimol VPS'dagi database'da history bor (chunki u production server).

**Qadamlar:**

```bash
# 1. VPS'ga kirish
ssh user@shop.avtofix.uz

# 2. MongoDB'ga ulanish
mongosh

# 3. Database tanlash
use avtofix

# 4. History tekshirish
db.product_history.countDocuments()

# 5. Kechagi soat 17:00 dagi history
db.product_history.find({
  type: 'delete',
  createdAt: {
    $gte: ISODate('2025-02-16T17:00:00.000Z'),
    $lte: ISODate('2025-02-16T17:59:59.999Z')
  }
}).pretty()
```

**Agar history bo'lsa:**

```bash
# VPS'da export
mongodump --db avtofix --collection product_history --out /tmp/backup

# Local'ga ko'chirish
exit  # VPS'dan chiqish
scp -r user@shop.avtofix.uz:/tmp/backup ~/Desktop/vps-backup

# Local'da import
mongorestore --db avtofix ~/Desktop/vps-backup/avtofix

# Restore script
cd AvtoFix
npx tsx scripts/restore-yesterday-17.ts
```

---

### 2. ✅ MongoDB Backup Tekshirish

Agar MongoDB backup olingan bo'lsa:

```bash
# Backup tekshirish
npx tsx scripts/check-mongodb-backup.ts
```

**Odatiy backup papkalari:**
- `C:\data\backup`
- `C:\mongodb\backup`
- `C:\backup`
- `C:\Users\[Username]\backup`

**Agar backup topilsa:**

```bash
# Backup'dan restore
mongorestore --db avtofix --drop C:\backup\2025-02-16\avtofix

# Restore script
npx tsx scripts/restore-yesterday-17.ts
```

---

### 3. ✅ Browser Cache/LocalStorage Tekshirish

Agar mahsulotlar sahifasi ochiq bo'lgan bo'lsa:

1. https://shop.avtofix.uz ga kiring
2. `F12` bosing
3. `Application` → `Local Storage` → `https://shop.avtofix.uz`
4. Quyidagi key'larni qidiring:
   - `productHistory`
   - `products`
   - `deletedProducts`

**Batafsil:** `CHECK-BROWSER-DATA.md` faylini o'qing

---

### 4. ✅ Excel Export Tekshirish

Agar mahsulotlarni Excel'ga export qilgan bo'lsangiz:

1. Desktop yoki Downloads papkasida `mahsulotlar_*.xlsx` fayllarni qidiring
2. Kechagi (2025-02-16) sanali fayllarni toping
3. Excel'dan import qiling:
   - Saytga kiring
   - "Excel Import" tugmasini bosing
   - Faylni yuklang

---

### 5. ⚠️ Manual Restore (Oxirgi Yo'l)

Agar hech qanday backup yo'q bo'lsa:

1. Mahsulotlar ro'yxatini eslang yoki yozing
2. Saytga kiring
3. Mahsulotlarni qaytadan qo'lda qo'shing

---

## 📋 Tavsiya Etilgan Tartib

1. **Birinchi:** VPS database tekshirish (eng kuchli yo'l)
2. **Ikkinchi:** MongoDB backup tekshirish
3. **Uchinchi:** Browser cache tekshirish
4. **To'rtinchi:** Excel export tekshirish
5. **Oxirgi:** Manual restore

---

## 🚀 Hozir Qiling

### 1. VPS Database Tekshirish

```bash
ssh user@shop.avtofix.uz
mongosh
use avtofix
db.product_history.countDocuments()
```

Natijani menga yuboring!

### 2. MongoDB Backup Tekshirish

```bash
npx tsx scripts/check-mongodb-backup.ts
```

Natijani menga yuboring!

---

## 💡 Keyingi Safar Uchun

1. **Backend kodini yangilash** - history logging yoqish
2. **Avtomatik backup** - har kuni MongoDB backup olish
3. **Excel export** - har kuni mahsulotlarni Excel'ga export qilish

---

**Yaratilgan:** 2025-02-17
**Versiya:** 1.0.0
