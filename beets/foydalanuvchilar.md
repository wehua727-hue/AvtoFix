# 👤 FOYDALANUVCHILAR - User Management

## 📋 Umumiy Ma'lumot

**Fayllar:**
- `client/pages/Users.tsx`
- `client/pages/Xodimlar.tsx`

**API:** `/api/users`

---

## 🎯 Rol Tizimi

### 1. Ega (Owner)
- Barcha huquqlar
- Foydalanuvchilarni boshqarish
- Obuna boshqaruvi
- Moliyaviy hisobotlar

### 2. Admin
- Ko'p huquqlar
- Foydalanuvchilarni ko'rish
- Mahsulot va savdo boshqaruvi
- Hisobotlar

### 3. Menejer
- Mahsulot boshqaruvi
- Kategoriya boshqaruvi
- Savdo ko'rish
- Cheklangan hisobotlar

### 4. Kassir
- Faqat savdo qilish
- Mahsulot qidirish
- Chek chop etish

---

## 🔧 Operatsiyalar

### 1. Foydalanuvchi Qo'shish
```typescript
{
  name: "Javohir",
  phone: "914058481",
  password: "1234567",
  role: "kassir",
  branchId: "..."
}
```

### 2. Parol O'zgartirish
```typescript
PUT /api/users/:id
{
  password: "newpassword"
}
```

### 3. Bloklash/Aktivlashtirish
```typescript
PUT /api/users/:id
{
  isBlocked: true
}
```

---

## 💳 Obuna Boshqaruvi

### Obuna Turlari:
- Oylik: 30 kun
- 3 oylik: 90 kun
- 6 oylik: 180 kun
- Yillik: 365 kun

### Obuna Tugash:
- 7 kun qolganda eslatma
- 3 kun qolganda eslatma
- 1 kun qolganda eslatma
- Tugaganda bloklash

---

**Yaratilgan:** 2025-02-10
