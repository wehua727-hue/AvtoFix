@echo off
REM Git hooks'ni o'rnatish skripti (Windows)

echo 🔧 Git hooks o'rnatilmoqda...

if exist ".git-hooks" (
    xcopy /E /I /Y ".git-hooks\*" ".git\hooks\"
    echo ✅ Git hooks muvaffaqiyatli o'rnatildi!
    echo.
    echo 📝 Endi har safar commit qilganingizda:
    echo    - Yangi funksiyalar avtomatik aniqlanadi
    echo    - Hujjatlarni yangilash eslatmasi ko'rsatiladi
    echo    - beets/ va agents.md fayllarini yangilashingiz kerak
) else (
    echo ❌ Xato: .git-hooks papkasi topilmadi!
    exit /b 1
)

pause
