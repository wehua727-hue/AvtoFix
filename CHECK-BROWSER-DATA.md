# Browser Cache/LocalStorage Tekshirish

Ehtimol brauzerda mahsulotlar ma'lumotlari saqlangandir.

## 1. Browser Developer Tools Ochish

1. https://shop.avtofix.uz ga kiring
2. `F12` bosing (yoki `Ctrl+Shift+I`)
3. `Application` tab'ini oching

## 2. LocalStorage Tekshirish

1. Chap tarafda `Local Storage` ni oching
2. `https://shop.avtofix.uz` ni tanlang
3. Quyidagi key'larni qidiring:
   - `productHistory`
   - `products`
   - `deletedProducts`
   - `backup`

## 3. Agar Ma'lumot Bo'lsa

Agar LocalStorage'da ma'lumot bo'lsa:

1. Key'ni bosing
2. Value'ni ko'ring (JSON format)
3. Copy qiling
4. Yangi fayl yarating: `browser-backup.json`
5. Paste qiling

Keyin script orqali import qilish mumkin.

## 4. IndexedDB Tekshirish

1. Chap tarafda `IndexedDB` ni oching
2. Database'larni ko'ring
3. `products` yoki `history` nomli table'larni qidiring

## 5. Network Tab Tekshirish

Agar mahsulotlarni o'chirishdan oldin sahifa ochiq bo'lgan bo'lsa:

1. `Network` tab'ini oching
2. `Preserve log` ni yoqing
3. `products` qidiring
4. Response'larni ko'ring

Ehtimol o'chirilgan mahsulotlar ma'lumotlari saqlangandir.

## 6. Browser History Tekshirish

Agar mahsulotlar sahifasini ochgan bo'lsangiz:

1. `Ctrl+H` bosing (History)
2. Kechagi (2025-02-16) sahifalarni qidiring
3. Mahsulotlar sahifasini oching
4. Agar cache'da bo'lsa, mahsulotlar ko'rinishi mumkin

---

**Muhim:** Bu yo'l faqat brauzerda ma'lumot saqlanganida ishlaydi.
