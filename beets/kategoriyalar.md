# 📁 KATEGORIYALAR - Category Management

## 📋 Umumiy Ma'lumot

**Fayl:** `client/pages/AddCategory.tsx`

**API:** `/api/categories`

---

## 🎯 Asosiy Funksiyalar

### 1. Kategoriya Qo'shish
```typescript
{
  name: "Moylar",
  parentId: null,  // Root kategoriya
  userId: "..."
}
```

### 2. Ichki Kategoriya
```typescript
{
  name: "Motor moylari",
  parentId: "...",  // Ota kategoriya ID
  userId: "..."
}
```

### 3. Kategoriya Darajasi
- Level 0: Root kategoriya
- Level 1: Ichki kategoriya
- Level 2: Ichki-ichki kategoriya

---

## 🌳 Daraxt Tuzilmasi

```
Moylar (Level 0)
├── Motor moylari (Level 1)
│   ├── 5W-30 (Level 2)
│   └── 10W-40 (Level 2)
└── Transmissiya moylari (Level 1)
    ├── ATF (Level 2)
    └── MTF (Level 2)
```

---

## 🔧 Operatsiyalar

### CRUD:
- Create: Yangi kategoriya
- Read: Kategoriyalar ro'yxati
- Update: Kategoriya nomini o'zgartirish
- Delete: Kategoriyani o'chirish

### Validatsiya:
- Kategoriya nomi bo'sh bo'lmasligi kerak
- Dublikat kategoriya bo'lmasligi kerak
- Kategoriyada mahsulot bo'lsa o'chirib bo'lmaydi

---

**Yaratilgan:** 2025-02-10
