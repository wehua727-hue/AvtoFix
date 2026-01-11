# 🔐 Login Qo'llanmasi

## ✅ Yangi Ega Yaratildi!

`````
📱 Telefon: 914058481
🔐 Parol: 1234567
👑 Rol: Ega (egasi)
```

## 🚀 Ishlatish Qadamlari

### 1. Browser Cache ni Tozalash
**Chrome/Edge:**
- `Ctrl + Shift + Delete` (Windows) yoki `Cmd + Shift + Delete` (Mac)
- "Cookies va boshqa sayt ma'lumotlari" ni tanlang
- "Barcha vaqt" ni tanlang
- "Tozalash" tugmasini bosing

**Firefox:**
- `Ctrl + Shift + Delete` (Windows) yoki `Cmd + Shift + Delete` (Mac)
- "Barcha" ni tanlang
- "Tozalash" tugmasini bosing

### 2. Ilovani Qayta Yuklash
```bash
# Terminal da:
pnpm run dev
```

### 3. Login Qilish
1. Browser da `http://localhost:5174` ni oching
2. Telefon raqamini kiriting: **914058481**
3. Parolni kiriting: **1234567**
4. "Kirish" tugmasini bosing

## 🔧 Agar Hali Xato Bo'lsa

### Xato 1: "Bu telefon raqami bilan hisob topilmadi"
```bash
# Yangi egani qayta yaratish:
pnpm run create-owner
```

### Xato 2: "Server mavjud emas"
```bash
# Server ishlamoqda ekanligini tekshirish:
curl http://localhost:5175/api/health

# Agar javob bo'lmasa, serverini qayta ishga tushirish:
pnpm run dev
```

### Xato 3: WebSocket xatosi
- Bu warning, xatolik emas
- Browser cache ni tozalang va qayta yuklang

## 📋 Tekshirish

### 1. Server Ishlamoqda Ekanligini Tekshirish
```bash
curl http://localhost:5175/api/health
# Javob: {"status":"ok"}
```

### 2. Login Tekshirish
```bash
curl -X POST http://localhost:5175/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"914058481","password":"1234567"}'
```

### 3. Foydalanuvchilarni Ko'rish
```bash
pnpm run restore-users
```

## 🎯 Keyingi Qadamlar

1. ✅ Login qilish
2. ✅ Mahsulotlarni qo'shish
3. ✅ Do'konlarni yaratish
4. ✅ Xodimlarni qo'shish

## 💡 Maslahatlar

- **Telefon raqami:** Faqat raqamlar (914058481)
- **Parol:** Harf va raqamlar (1234567)
- **Browser:** Chrome, Firefox, Edge
- **Port:** Frontend 5174, Backend 5175

## 🆘 Agar Hali Muammo Bo'lsa

1. Browser console ni oching (`F12`)
2. Xatolarni ko'ring
3. Terminal da `pnpm run restore-users` ishga tushiring
4. Qayta login qilishni sinab ko'ring

---

**Muvaffaqiyatli login qilishni tilaymiz! 🎉**
