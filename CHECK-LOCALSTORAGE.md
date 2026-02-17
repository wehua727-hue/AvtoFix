# LocalStorage'dan History Olish

## 🎯 MUHIM: Frontend'da History Saqlanadi!

Frontend kodida `localStorage` ga history saqlanadi. Agar siz mahsulotlar sahifasini ochgan bo'lsangiz, history saqlangandir!

## 📋 Qadamlar

### 1. Saytga Kirish

```
https://shop.avtofix.uz
```

Login qiling (910712828 / avtofix202508)

### 2. Developer Tools Ochish

`F12` bosing yoki `Ctrl+Shift+I`

### 3. Console Tab'ini Ochish

Console'da quyidagi kodni yozing:

```javascript
// History'ni olish
const userId = '697746478dc86ae74f75ad07';
const history = localStorage.getItem(`productHistory_${userId}`);

if (history) {
  const parsed = JSON.parse(history);
  console.log('✅ History topildi:', parsed.length, 'ta');
  console.log('📋 History:', parsed);
  
  // Kechagi soat 17:00 dagi o'chirilganlar
  const yesterday = new Date('2025-02-16T17:00:00');
  const yesterdayEnd = new Date('2025-02-16T17:59:59');
  
  const deleted = parsed.filter(item => {
    if (item.type !== 'delete') return false;
    const date = new Date(item.timestamp);
    return date >= yesterday && date <= yesterdayEnd;
  });
  
  console.log('🗑️  Kechagi soat 17:00 dagi o\'chirilganlar:', deleted.length, 'ta');
  console.log('📋 O\'chirilganlar:', deleted);
  
  // JSON formatda ko'rsatish (copy qilish uchun)
  console.log('📄 JSON (copy qiling):');
  console.log(JSON.stringify(deleted, null, 2));
} else {
  console.log('❌ History topilmadi');
}
```

### 4. Natijani Ko'rish

Agar history topilsa:
- `✅ History topildi: 500 ta` - history bor!
- `🗑️ Kechagi soat 17:00 dagi o'chirilganlar: 15 ta` - o'chirilganlar topildi!
- JSON formatda ma'lumotlar ko'rsatiladi

### 5. JSON'ni Copy Qilish

1. Console'da JSON'ni ko'ring
2. O'ng tugma → Copy
3. Yangi fayl yarating: `localStorage-history.json`
4. Paste qiling

### 6. JSON'dan Restore Qilish

Men sizga script yarataman - JSON fayldan mahsulotlarni qaytarish uchun.

---

## ⚠️ Agar History Topilmasa

Agar `❌ History topilmadi` deb ko'rsatsa:

1. **Boshqa brauzerda ochilganmi?** - Chrome, Firefox, Edge'da tekshiring
2. **Boshqa kompyuterda ochilganmi?** - o'sha kompyuterda tekshiring
3. **Cache tozalanganmi?** - afsuski, qaytarib bo'lmaydi

---

## 🚀 Hozir Qiling

1. https://shop.avtofix.uz ga kiring
2. `F12` bosing
3. Console'ga yuqoridagi kodni paste qiling
4. Enter bosing
5. Natijani menga yuboring!

---

**Bu eng kuchli yo'l!** Agar localStorage'da history bo'lsa, mahsulotlarni qaytarish mumkin! ✅
