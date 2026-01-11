# 🔧 Foydalanuvchilar Muammosi - Tuzatish Qo'llanmasi

## 🚨 Muammo
Foydalanuvchi o'chirilganda, barcha foydalanuvchilar o'chib ketdi.

## ✅ Tuzatish

### 1. Yangi Egani Yaratish
```bash
pnpm run create-owner
```

Bu script:
- ✅ Telefon: **914058481**
- ✅ Parol: **1234567**
- ✅ Rol: **Ega (egasi)**
- ✅ Yangi do'kon yaratadi

### 2. Foydalanuvchilarni Tiklash
```bash
pnpm run restore-users
```

Bu script:
- ✅ Barcha mavjud foydalanuvchilarni ko'rsatadi
- ✅ Yangi egani yaratadi (agar yo'q bo'lsa)
- ✅ Mahsulotlarni tekshiradi

## 🔍 Muammoning Sababi

`server/routes/users.ts` da `handleUserDelete` funksiyasi:
- Foydalanuvchi o'chirilganda, uning barcha ma'lumotlari o'chiriladi
- **LEKIN**: Agar egasi o'chirilsa, uning barcha xodimlar va adminlari ham o'chiriladi
- Bu cascading delete muammosiga olib keldi

## 🛠️ Tuzatish Qilindi

### 1. `deleteUserData` Funksiyasi
- `deleteProducts` parametri qo'shildi
- Agar `deleteProducts=false` bo'lsa, mahsulotlar saqlanadi (userId ni null qiladi)
- Agar `deleteProducts=true` bo'lsa, mahsulotlar o'chiriladi

### 2. `handleUserDelete` Funksiyasi
- Egasi o'chirilganda, uning mahsulotlari o'chiriladi
- Xodim/admin o'chirilganda, mahsulotlari saqlanadi

### 3. Yangi Scriptlar
- `create-owner.ts` - Yangi egani yaratish
- `restore-users.ts` - Foydalanuvchilarni tiklash

## 📝 Kirish Ma'lumotlari

```
📱 Telefon: 914058481
🔐 Parol: 1234567
👑 Rol: Ega (egasi)
```

## 🚀 Ishlatish

1. **Yangi egani yaratish:**
   ```bash
   pnpm run create-owner
   ```

2. **Foydalanuvchilarni tekshirish:**
   ```bash
   pnpm run restore-users
   ```

3. **Ilovani ishga tushirish:**
   ```bash
   pnpm run dev
   ```

4. **Kirish:**
   - Telefon: 914058481
   - Parol: 1234567

## ✨ Yangi Xususiyatlar

- ✅ Foydalanuvchi o'chirilganda, mahsulotlar saqlanadi
- ✅ Egasi o'chirilganda, xodimlar o'chiriladi (lekin mahsulotlar saqlanadi)
- ✅ Yangi egani yaratish scripti
- ✅ Foydalanuvchilarni tiklash scripti

## 🎯 Keyingi Qadamlar

1. Yangi egani yaratish: `pnpm run create-owner`
2. Ilovani ishga tushirish: `pnpm run dev`
3. Kirish: 914058481 / 1234567
4. Mahsulotlarni qo'shish va boshqarish

---

**Agar muammo davom etsa, `pnpm run restore-users` buyrug'ini ishga tushiring.**
