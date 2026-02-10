# 💱 CURRENCY - Valyuta Tizimi

## 📋 Umumiy Ma'lumot

**Fayllar:**
- `server/routes/currency.ts`
- `client/components/CurrencyPriceInput.tsx`

**API:** `/api/currency/rates`

---

## 💰 Qo'llab-quvvatlanadigan Valyutalar

### 1. UZS - O'zbekiston So'mi
- Belgisi: so'm
- Rang: Ko'k

### 2. USD - Amerika Dollari
- Belgisi: $
- Rang: Yashil
- Kurs: ~12,500 UZS

### 3. RUB - Rossiya Rubli
- Belgisi: ₽
- Rang: Binafsha
- Kurs: ~135 UZS

### 4. CNY - Xitoy Yuani
- Belgisi: ¥
- Rang: Sariq
- Kurs: ~1,750 UZS

---

## 🔄 Valyuta Konvertatsiyasi

### Konvertatsiya Formulasi:
```typescript
const convertPrice = (price, from, to) => {
  // 1. UZS ga konvertatsiya
  const inUZS = from === 'UZS' 
    ? price 
    : price * rates[from];
  
  // 2. Kerakli valyutaga konvertatsiya
  return to === 'UZS' 
    ? inUZS 
    : inUZS / rates[to];
};
```

### Misol:
```typescript
// $100 ni so'mga
convertPrice(100, 'USD', 'UZS') // 1,250,000

// 1,250,000 so'm ni dollarga
convertPrice(1250000, 'UZS', 'USD') // 100
```

---

## 📊 Kurs Yangilanishi

### Avtomatik Yangilanish:
```typescript
// Har kuni soat 9:00 da
cron.schedule('0 9 * * *', async () => {
  const rates = await fetchExchangeRates();
  await saveRates(rates);
});
```

### Qo'lda Yangilanish:
```typescript
PUT /api/currency/rates
{
  USD: 12500,
  RUB: 135,
  CNY: 1750
}
```

---

## 🎨 UI Komponent

### CurrencyPriceInput:
```typescript
<CurrencyPriceInput
  value={price}
  currency={currency}
  onChange={(value, currency) => {
    setPrice(value);
    setCurrency(currency);
  }}
/>
```

---

**Yaratilgan:** 2025-02-10
