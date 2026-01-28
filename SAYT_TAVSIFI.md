# AvtoFix - Oflayn Do'kon Tizimi

## Umumiy Ma'lumot

**AvtoFix** - bu avtomobil ehtiyot qismlari do'koni uchun maxsus ishlab chiqilgan oflayn savdo tizimi. Tizim internet aloqasi bo'lmagan holda ham to'liq ishlaydi va barcha ma'lumotlarni mahalliy kompyuterda saqlaydi.

---

## Asosiy Qismlar

### 1. **Sidebar (Chap Menyu)**

Saytning chap tomonida joylashgan asosiy navigatsiya menyusi. Bu yerda barcha asosiy bo'limlar mavjud.

#### 1.1. **Kassa (Savdo)**
- **Vazifasi:** Mahsulot sotish va hisob-kitob qilish
- **Nima qiladi:**
  - Mijozga mahsulot sotish
  - Mahsulot qidirish (kod, nom, shtrix-kod orqali)
  - Savat (savatcha) - tanlangan mahsulotlar ro'yxati
  - Narxni hisoblash (so'm, dollar, rubl)
  - To'lov qabul qilish (naqd, karta, nasiya)
  - Chek chop etish
  - Savdo tarixini ko'rish

#### 1.2. **Mahsulotlar**
- **Vazifasi:** Mahsulotlarni boshqarish
- **Nima qiladi:**
  - Barcha mahsulotlar ro'yxati
  - Mahsulot qo'shish, tahrirlash, o'chirish
  - Mahsulot xillari (variantlar) boshqarish
  - Kategoriyalar bo'yicha filtrlash
  - Qidiruv (nom, kod, katalog bo'yicha)
  - Mahsulot rasmini yuklash
  - Narx, ombordagi soni, valyuta sozlash
  - Excel dan import qilish
  - Rasm dan import qilish (OCR)

#### 1.3. **Kategoriyalar**
- **Vazifasi:** Mahsulotlarni guruhlash
- **Nima qiladi:**
  - Kategoriya qo'shish, tahrirlash, o'chirish
  - Ota-kategoriya va ichki kategoriyalar yaratish
  - Kategoriya nomini o'zgartirish
  - Kategoriya bo'yicha mahsulotlarni ko'rish

#### 1.4. **Tarix**
- **Vazifasi:** Barcha savdo operatsiyalarini kuzatish
- **Nima qiladi:**
  - Barcha sotilgan mahsulotlar ro'yxati
  - Sana bo'yicha filtrlash
  - Mijoz bo'yicha filtrlash
  - To'lov turi bo'yicha filtrlash
  - Umumiy summa va statistika
  - Chekni qayta chop etish
  - Savdoni bekor qilish (qaytarish)

#### 1.5. **Hisobotlar**
- **Vazifasi:** Savdo statistikasi va tahlil
- **Nima qiladi:**
  - Kunlik, haftalik, oylik savdo hisoboti
  - Eng ko'p sotiladigan mahsulotlar
  - Daromad va foyda hisoboti
  - Ombordagi mahsulotlar holati
  - Grafik va diagrammalar
  - Excel ga eksport qilish

#### 1.6. **Sozlamalar**
- **Vazifasi:** Tizim sozlamalari
- **Nima qiladi:**
  - Foydalanuvchi profili
  - Valyuta kurslari (so'm, dollar, rubl)
  - Printer sozlamalari
  - Chek dizayni
  - Do'kon ma'lumotlari (nom, manzil, telefon)
  - Til sozlamalari
  - Zaxira nusxa (backup)

#### 1.7. **Foydalanuvchilar** (Admin uchun)
- **Vazifasi:** Xodimlarni boshqarish
- **Nima qiladi:**
  - Yangi foydalanuvchi qo'shish
  - Foydalanuvchi huquqlarini sozlash
  - Parol o'zgartirish
  - Foydalanuvchi faoliyatini ko'rish
  - Foydalanuvchini o'chirish yoki bloklash

---

## Asosiy Funksiyalar

### 2. **Kassa (Savdo Jarayoni)**

#### 2.1. Mahsulot Qidirish
- **Shtrix-kod skaneri:** Mahsulotni avtomatik qidirish
- **Kod bo'yicha:** Mahsulot kodini kiritish
- **Nom bo'yicha:** Mahsulot nomini yozish
- **Katalog bo'yicha:** Katalog raqamini kiritish

#### 2.2. Savat (Savatcha)
- Tanlangan mahsulotlar ro'yxati
- Miqdorni o'zgartirish
- Mahsulotni o'chirish
- Umumiy summa ko'rsatiladi
- Chegirma qo'llash

#### 2.3. To'lov
- **Naqd pul:** Mijoz naqd to'laydi
- **Karta:** Bank kartasi orqali to'lov
- **Nasiya:** Keyinroq to'lash (qarz)
- **Aralash:** Bir qismi naqd, bir qismi karta

#### 2.4. Chek Chop Etish
- Avtomatik chek chop etish
- Chek dizayni sozlanadi
- Do'kon ma'lumotlari ko'rsatiladi
- Mahsulotlar ro'yxati
- Umumiy summa va to'lov turi

---

### 3. **Mahsulotlar Boshqaruvi**

#### 3.1. Mahsulot Qo'shish
- **Asosiy ma'lumotlar:**
  - Mahsulot nomi (rus, o'zbek)
  - Mahsulot kodi
  - Katalog raqami
  - Kategoriya
  - Narx (so'm, dollar, rubl)
  - Ombordagi soni
  - Minimal soni (ogohlantirish uchun)

- **Qo'shimcha ma'lumotlar:**
  - Mahsulot rasmi
  - Tavsif
  - Ishlab chiqaruvchi
  - Kafolat muddati

#### 3.2. Mahsulot Xillari (Variantlar)
- Bir mahsulotning turli xillari
- Masalan: "Moy 5W-30" mahsulotining 1L, 4L, 5L xillari
- Har bir xil uchun alohida narx va ombordagi soni

#### 3.3. Excel dan Import
- Excel fayldan mahsulotlarni yuklash
- Avtomatik kategoriyaga ajratish
- Dublikat tekshirish
- Birinchi 2 so'z bilan guruhlash
- Xillarni avtomatik yaratish

#### 3.4. Rasm dan Import (OCR)
- Jadval rasmini yuklash
- OCR (Optical Character Recognition) - matnni tanish
- Jadval ni avtomatik parse qilish
- Mahsulotlarni qo'shish

---

### 4. **Kategoriyalar**

#### 4.1. Kategoriya Tuzilmasi
- **Ota kategoriya:** Asosiy guruh (masalan: "Moylar")
- **Ichki kategoriya:** Kichik guruh (masalan: "Motor moylari", "Transmissiya moylari")
- **Daraxt ko'rinishi:** Kategoriyalar daraxt shaklida ko'rsatiladi

#### 4.2. Kategoriya Operatsiyalari
- Yangi kategoriya qo'shish
- Kategoriya nomini o'zgartirish
- Kategoriyani o'chirish
- Kategoriyani ko'chirish (boshqa kategoriya ichiga)

---

### 5. **Tarix va Hisobotlar**

#### 5.1. Savdo Tarixi
- Barcha sotilgan mahsulotlar
- Sana, vaqt, mijoz, summa
- To'lov turi (naqd, karta, nasiya)
- Chekni qayta ko'rish va chop etish

#### 5.2. Statistika
- **Kunlik savdo:** Bugungi savdo summasi
- **Haftalik savdo:** Shu hafta savdo summasi
- **Oylik savdo:** Shu oy savdo summasi
- **Yillik savdo:** Shu yil savdo summasi

#### 5.3. Eng Ko'p Sotiladigan Mahsulotlar
- TOP 10 mahsulotlar
- Sotilgan miqdor
- Umumiy summa

#### 5.4. Ombor Holati
- Ombordagi mahsulotlar soni
- Tugab qolgan mahsulotlar
- Kam qolgan mahsulotlar (ogohlantirish)

---

## Texnik Xususiyatlar

### 6. **Oflayn Ishlash**

#### 6.1. Ma'lumotlar Saqlash
- **IndexedDB:** Brauzerda mahalliy ma'lumotlar bazasi
- **MongoDB:** Serverda asosiy ma'lumotlar bazasi
- **Sinxronizatsiya:** Internet bo'lganda avtomatik sinxronizatsiya

#### 6.2. Oflayn Rejim
- Internet yo'q bo'lsa ham ishlaydi
- Barcha operatsiyalar mahalliy saqlanadi
- Internet qaytganda avtomatik yuboriladi

---

### 7. **Qidiruv Tizimi**

#### 7.1. Tez Qidiruv
- Mahsulot nomini yozish bilan qidirish
- Kod bo'yicha qidirish
- Katalog bo'yicha qidirish
- Shtrix-kod bo'yicha qidirish

#### 7.2. Filtrlash
- Kategoriya bo'yicha
- Narx oralig'i bo'yicha
- Ombordagi soni bo'yicha
- Valyuta bo'yicha

---

### 8. **Chek Chop Etish**

#### 8.1. Printer Sozlamalari
- **USB printer:** Kompyuterga ulangan printer
- **Bluetooth printer:** Simsiz printer
- **Tarmoq printer:** Tarmoq orqali ulangan printer

#### 8.2. Chek Dizayni
- Do'kon logotipi
- Do'kon nomi va manzili
- Telefon raqami
- Mahsulotlar ro'yxati
- Umumiy summa
- To'lov turi
- Sana va vaqt
- Kassir ismi

---

### 9. **Valyuta Tizimi**

#### 9.1. Qo'llab-quvvatlanadigan Valyutalar
- **So'm (UZS):** O'zbekiston so'mi
- **Dollar (USD):** Amerika dollari
- **Rubl (RUB):** Rossiya rubli

#### 9.2. Valyuta Kurslari
- Kunlik kurs yangilanadi
- Qo'lda kurs kiritish mumkin
- Avtomatik konvertatsiya

---

### 10. **Xavfsizlik**

#### 10.1. Foydalanuvchi Autentifikatsiyasi
- Login va parol
- Sessiya boshqaruvi
- Avtomatik chiqish (timeout)

#### 10.2. Huquqlar Tizimi
- **Admin:** Barcha huquqlar
- **Menejer:** Mahsulot va kategoriya boshqarish
- **Kassir:** Faqat savdo qilish

#### 10.3. Ma'lumotlar Xavfsizligi
- Parollar shifrlangan
- Ma'lumotlar zaxira nusxasi (backup)
- Tizim loglari (kim, qachon, nima qildi)

---

## Qo'shimcha Funksiyalar

### 11. **Excel Import**

#### 11.1. Excel Fayl Formati
- **Ustunlar:**
  - Mahsulot nomi
  - Mahsulot kodi
  - Katalog raqami
  - Narx
  - Ombordagi soni
  - Kategoriya

#### 11.2. Import Jarayoni
1. Excel faylni tanlash
2. Ustunlarni sozlash (mapping)
3. Ma'lumotlarni ko'rib chiqish
4. Tahrirlash (agar kerak bo'lsa)
5. Import qilish

#### 11.3. Dublikat Tekshirish
- Mahsulot nomi bo'yicha
- Mahsulot kodi bo'yicha
- Katalog raqami bo'yicha
- Dublikat topilsa o'tkazib yuboriladi

#### 11.4. Birinchi 2 So'z bilan Guruhlash
- Mahsulot nomining birinchi 2 so'zi bir xil bo'lsa
- Birinchi mahsulot ota mahsulot bo'ladi
- Qolganlari xil (variant) bo'ladi
- Masalan:
  - "Javohir Fozilov Qodirovich" → ota mahsulot
  - "Javohir Fozilov Jabirovich" → xil
  - "Javohir Qodirov Fozilovich" → yangi mahsulot


### 13. **Telegram Bot**

#### 13.1. Bot Funksiyalari
- Mahsulot qidirish
- Narx so'rash
- Ombordagi soni so'rash
- Buyurtma berish
- Savdo hisoboti olish

#### 13.2. Xabarlar
- Yangi buyurtma haqida xabar
- Ombor tugab qolgan mahsulot haqida ogohlantirish
- Kunlik savdo hisoboti

---

## Foydalanish Stsenariylari

### 14. **Oddiy Savdo**

1. Kassir tizimga kiradi
2. "Kassa" bo'limiga o'tadi
3. Mahsulotni qidiradi (kod, nom, shtrix-kod)
4. Mahsulotni savatga qo'shadi
5. Miqdorni o'zgartiradi (agar kerak bo'lsa)
6. "To'lov" tugmasini bosadi
7. To'lov turini tanlaydi (naqd, karta)
8. Chek chop etiladi
9. Mijozga chek beriladi

---

### 15. **Mahsulot Qo'shish**

1. Menejer tizimga kiradi
2. "Mahsulotlar" bo'limiga o'tadi
3. "Yangi mahsulot" tugmasini bosadi
4. Ma'lumotlarni to'ldiradi:
   - Nomi
   - Kodi
   - Katalog raqami
   - Kategoriya
   - Narx
   - Ombordagi soni
5. Rasmni yuklaydi (agar kerak bo'lsa)
6. "Saqlash" tugmasini bosadi

---

### 16. **Excel dan Import**

1. Menejer Excel faylni tayyorlaydi
2. "Mahsulotlar" bo'limiga o'tadi
3. "Excel Import" tugmasini bosadi
4. Excel faylni tanlaydi
5. Ustunlarni sozlaydi (mapping)
6. Ma'lumotlarni ko'rib chiqadi
7. Tahrirlaydi (agar kerak bo'lsa)
8. "Import" tugmasini bosadi
9. Mahsulotlar qo'shiladi

---

### 17. **Hisobot Olish**

1. Admin tizimga kiradi
2. "Hisobotlar" bo'limiga o'tadi
3. Sana oralig'ini tanlaydi
4. Hisobot turini tanlaydi:
   - Savdo hisoboti
   - Ombor hisoboti
   - Foyda hisoboti
5. "Ko'rish" tugmasini bosadi
6. Hisobotni ko'radi
7. Excel ga eksport qiladi (agar kerak bo'lsa)

---

## Xulosa

**AvtoFix** tizimi - bu avtomobil ehtiyot qismlari do'koni uchun to'liq yechim. Tizim oflayn ishlaydi, barcha zarur funksiyalarga ega va foydalanish uchun qulay.

### Asosiy Afzalliklar:
✅ **Oflayn ishlash** - internet kerak emas
✅ **Tez qidiruv** - mahsulotni bir soniyada topish
✅ **Excel import** - ko'p mahsulotni bir vaqtda qo'shish
✅ **Rasm import (OCR)** - jadval rasmidan mahsulot qo'shish
✅ **Chek chop etish** - avtomatik chek
✅ **Hisobotlar** - savdo statistikasi
✅ **Telegram bot** - mijozlar bilan aloqa
✅ **Ko'p valyuta** - so'm, dollar, rubl
✅ **Xavfsiz** - foydalanuvchi huquqlari
✅ **Zaxira nusxa** - ma'lumotlar xavfsizligi

---

**Ishlab chiqilgan:** 2025-yil
**Versiya:** 1.0
**Texnologiya:** React, TypeScript, Node.js, MongoDB, IndexedDB
