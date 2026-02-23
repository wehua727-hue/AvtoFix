# Excel Import CORS Xatosini Tuzatish

## Muammo
"Unexpected token 'B', "Blocked re"... is not valid JSON" xatosi - bu CORS (Cross-Origin Resource Sharing) muammosi.

## Tuzatilgan O'zgarishlar

### 1. Server Tarafida (AvtoFix/server/index.ts)
- ✅ JSON limit 10MB dan 50MB ga oshirildi
- ✅ CORS sozlamalari soddalashtirildi - barcha origin'larga ruxsat
- ✅ OPTIONS so'rovlari uchun alohida handler qo'shildi
- ✅ Error handling middleware qo'shildi

### 2. Excel Import Route (AvtoFix/server/routes/excel-import.ts)
- ✅ CORS header'lari qo'lda qo'shildi
- ✅ Response header'lari to'g'rilandi

### 3. Client Tarafida (AvtoFix/client/components/ExcelImportModal.tsx)
- ✅ Fetch so'roviga CORS rejimi qo'shildi
- ✅ Xatolik handling yaxshilandi
- ✅ Non-JSON response tekshiruvi qo'shildi

## Ishga Tushirish

### Development (Local)
```bash
# 1. Serverni ishga tushiring
npm run dev

# yoki
npm start

# 2. Brauzerda ochish
http://localhost:5173
```

### Production
```bash
# .env faylida VITE_API_URL ni to'g'ri sozlang
VITE_API_URL="https://shop.avtofix.uz"
```

## Xatolikni Tekshirish

Agar xatolik davom etsa:

1. **Brauzer Console'ni tekshiring** (F12 > Console)
   - To'liq xatolik xabarini ko'ring
   - Network tab'da so'rov va javobni tekshiring

2. **Server Console'ni tekshiring**
   - Server loglarida xatolik bormi?
   - CORS xabarlari bormi?

3. **Excel Fayl Hajmini Tekshiring**
   - Maksimal hajm: 50MB
   - Agar kattaroq bo'lsa, faylni kichikroq qismlarga bo'ling

4. **API URL'ni Tekshiring**
   - `.env.local` faylida to'g'ri URL borligini tekshiring
   - Development: `http://localhost:5175`
   - Production: `https://shop.avtofix.uz`

## Qo'shimcha Maslahatlar

### Agar CORS Xatosi Davom Etsa

1. **Brauzer Cache'ni Tozalash**
   ```
   Ctrl + Shift + Delete
   ```

2. **Serverni To'liq Qayta Ishga Tushirish**
   ```bash
   # Serverni to'xtatish (Ctrl+C)
   # Keyin qayta ishga tushirish
   npm run dev
   ```

3. **Port'ni Tekshirish**
   - Server 5175 portda ishga tushganligini tekshiring
   - `netstat -ano | findstr :5175` (Windows)

4. **Firewall/Antivirus**
   - Ba'zan firewall yoki antivirus bloklashi mumkin
   - Vaqtincha o'chirib ko'ring

## Xatolik Xabarlari

### "Blocked re..." - CORS xatosi
- Server CORS sozlamalari noto'g'ri
- API URL noto'g'ri (.env faylida)

### "Fayl hajmi juda katta"
- Excel fayl 50MB dan katta
- Faylni kichikroq qismlarga bo'ling

### "Server noto'g'ri javob qaytardi"
- Server ishlamayotgan
- API URL noto'g'ri
- Network muammosi

## Yordam

Agar muammo hal bo'lmasa:
1. Server va client console loglarini to'liq nusxalang
2. Network tab'dan so'rov va javob header'larini nusxalang
3. Excel fayl hajmini va formatini tekshiring
