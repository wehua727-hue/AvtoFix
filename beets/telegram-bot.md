# 🤖 TELEGRAM BOT - Xabarlar va Eslatmalar

## 📋 Umumiy Ma'lumot

**Fayl:** `server/telegram-bot.ts`

**Texnologiya:** node-telegram-bot-api

**Bot Token:** `.env` faylida `TELEGRAM_BOT_TOKEN`

---

## 🎯 Asosiy Funksiyalar

### 1. Tug'ilgan Kun Eslatmalari
- Har kuni soat 9:00 da tekshirish
- Bugun va yaqin 7 kun ichida tug'ilgan kunlar
- Mijoz ismi va telefon raqami

### 2. Qarz Eslatmalari
- Har kuni soat 10:00 da
- Muddati o'tgan qarzlar
- Qarz summasi va mijoz ma'lumotlari

### 3. Obuna Tugash Eslatmalari
- 7, 3, 1 kun qolganda
- Obuna tugash sanasi
- To'lov ma'lumotlari

### 4. Ombor Tugash Xabarlari
- Mahsulot 10 dan kam qolganda
- Mahsulot nomi va qolgan soni

---

## 📱 Telegram Setup

### Bot Yaratish:
1. @BotFather ga yozing
2. `/newbot` komandasi
3. Bot nomi va username
4. Token olish

### Webhook yoki Polling:
```typescript
// Polling (development)
bot.startPolling();

// Webhook (production)
bot.setWebHook('https://shop.avtofix.uz/telegram-webhook');
```

---

## 💬 Xabar Formatlari

### Tug'ilgan Kun:
```
🎂 Tug'ilgan Kun Eslatmasi

Mijoz: Javohir Fozilov
Telefon: +998 90 123 45 67
Tug'ilgan kun: 15.02.2025 (5 kun qoldi)

Tabriklab, chegirma bering! 🎉
```

### Qarz Eslatmasi:
```
💰 Qarz Eslatmasi

Qarz oluvchi: Javohir Fozilov
Telefon: +998 90 123 45 67
Summa: 500,000 so'm
Muddati: 10.02.2025 (muddati o'tgan)

Iltimos, qarzni undiring! ⚠️
```

---

**Yaratilgan:** 2025-02-10
