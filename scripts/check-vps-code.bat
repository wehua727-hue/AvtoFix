@echo off
REM VPS Backend Kod Versiyasini Tekshirish (Windows)
REM Bu script VPSdagi backend kodining versiyasini tekshiradi

echo =========================================
echo VPS Backend Kod Versiyasini Tekshirish
echo =========================================
echo.

REM VPS ma'lumotlari
set VPS_HOST=shop.avtofix.uz
set VPS_USER=user
set VPS_PATH=/path/to/AvtoFix

echo VPS: %VPS_HOST%
echo Path: %VPS_PATH%
echo.

echo 1. Git versiyasini tekshirish...
ssh %VPS_USER%@%VPS_HOST% "cd %VPS_PATH% && git log -1 --oneline"
echo.

echo 2. Backend faylini tekshirish...
ssh %VPS_USER%@%VPS_HOST% "cd %VPS_PATH% && grep -c 'PRODUCT_HISTORY_COLLECTION' server/routes/products.ts"
echo.

echo 3. Delete funksiyasini tekshirish...
ssh %VPS_USER%@%VPS_HOST% "cd %VPS_PATH% && grep -c 'O'\''chirishdan OLDIN tarixga yozish' server/routes/products.ts"
echo.

echo 4. PM2 statusini tekshirish...
ssh %VPS_USER%@%VPS_HOST% "pm2 list"
echo.

echo 5. Backend loglarini ko'rish (oxirgi 20 qator)...
ssh %VPS_USER%@%VPS_HOST% "pm2 logs avtofix-api --lines 20 --nostream"
echo.

echo =========================================
echo Tekshirish tugadi
echo =========================================
echo.
echo Agar PRODUCT_HISTORY_COLLECTION = 0 bo'lsa, backend eski kod.
echo Agar PRODUCT_HISTORY_COLLECTION ^> 0 bo'lsa, backend yangi kod.
echo.
pause
