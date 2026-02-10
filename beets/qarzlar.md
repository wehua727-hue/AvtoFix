# 💰 QARZLAR - Debt Management

## 📋 Umumiy Ma'lumot

**Fayl:** `client/pages/Debts.tsx`

**API:** `/api/debts`

---

## 🎯 Asosiy Funksiyalar

### 1. Qarz Qo'shish
```typescript
{
  creditor: "Javohir Fozilov",
  phone: "+998901234567",
  amount: 500000,
  currency: "UZS",
  dueDate: "2025-03-10",
  description: "Moy sotib oldi"
}
```

### 2. Qarz To'lash
```typescript
PATCH /api/debts/:id/paid
```

### 3. Qarz Sozlash
```typescript
PATCH /api/debts/:id/adjust
{
  amount: 100000,
  reason: "Qisman to'landi"
}
```

### 4. Qora Ro'yxat
- To'lanmagan qarzlar
- Telefon raqami bo'yicha bloklash

---

## 📊 Qarz Statistikasi

- Jami qarzlar summasi
- To'langan qarzlar
- Kutilayotgan qarzlar
- Muddati o'tgan qarzlar

---

## ⚠️ Eslatmalar

- Telegram orqali eslatma
- Muddati o'tgan qarzlar
- Yaqinlashayotgan muddatlar

---

**Yaratilgan:** 2025-02-10
