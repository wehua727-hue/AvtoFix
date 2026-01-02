# Test: 0 Stock Mahsulotlar uchun Tasdiqlash

## O'zgarishlar
✅ 0 stock mahsulotlar uchun tasdiqlash dialogi qo'shildi
✅ Foydalanuvchi "Ha" desa kassaga qo'shiladi
✅ "Yo'q" desa qo'shilmaydi

## Test Qadamlari

### 1. SKU "1" ni Kiritish
- Numpad yoki barcode orqali **"1"** ni kiriting
- Tasdiqlash dialogi chiqishi kerak:
  ```
  "Гидромуфта GAS HOWO A7 0030" - omborda mavjud emas (0 ta).
  
  Baribir kassaga qo'shasizmi?
  [OK] [Cancel]
  ```

### 2. "OK" Bosganda
✅ Mahsulot kassaga qo'shiladi
✅ Stock 0 ko'rsatiladi
✅ Sotish mumkin (lekin ogohlantirish bilan)

### 3. "Cancel" Bosganda  
✅ Mahsulot kassaga qo'shilmaydi
✅ Hech narsa bo'lmaydi

### 4. Qidiruv Dialogida Ham
- F3 bosib qidiruv ochish
- "1" yoki "Гидромуфта" qidirish
- 0 stock mahsulotni bosish
- Xuddi shunday tasdiqlash dialogi

## Kutilayotgan Console Logs
```
[Kassa] ⚠️ Product has 0 stock, asking for confirmation: Гидромуфта GAS HOWO A7 0030
[Kassa] ✅ User confirmed adding 0-stock product  // OK bosganda
[Kassa] ❌ User cancelled adding 0-stock product  // Cancel bosganda
```

## Foydalanuvchi Tajribasi
- ✅ 0 stock mahsulotlar ko'rinadi
- ✅ Tasdiqlash so'raladi
- ✅ Xohlasa qo'shishi mumkin
- ✅ Xohlamasa qo'shmaydi
- ✅ Xavfsizlik saqlanadi