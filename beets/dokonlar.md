# 🏪 DO'KONLAR - Store/Branch Management

## 📋 Umumiy Ma'lumot

**Fayllar:**
- `client/pages/Stores.tsx`
- `client/pages/AddStore.tsx`

**API:** `/api/stores`

---

## 🎯 Asosiy Funksiyalar

### 1. Do'kon Qo'shish
```typescript
{
  name: "GM Filiali",
  address: "Toshkent, Chilonzor",
  phone: "+998901234567",
  userId: "..."
}
```

### 2. Do'kon Ma'lumotlari
- Do'kon nomi
- Manzil
- Telefon raqami
- Faol/Nofaol holati

### 3. Do'kon bo'yicha Mahsulotlar
```typescript
GET /api/products?storeId=...
```

---

## 📊 Do'kon Statistikasi

- Jami mahsulotlar soni
- Ombor qiymati
- Kunlik savdo
- Haftalik savdo

---

## 🔧 Operatsiyalar

- Do'kon qo'shish
- Do'kon tahrirlash
- Do'kon o'chirish
- Do'kon bo'yicha hisobot

---

**Yaratilgan:** 2025-02-10
