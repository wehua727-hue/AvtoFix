#!/bin/bash

# Git hooks'ni o'rnatish skripti

echo "🔧 Git hooks o'rnatilmoqda..."

# .git-hooks papkasidan .git/hooks papkasiga nusxalash
if [ -d ".git-hooks" ]; then
    cp -r .git-hooks/* .git/hooks/
    chmod +x .git/hooks/*
    echo "✅ Git hooks muvaffaqiyatli o'rnatildi!"
    echo ""
    echo "📝 Endi har safar commit qilganingizda:"
    echo "   - Yangi funksiyalar avtomatik aniqlanadi"
    echo "   - Hujjatlarni yangilash eslatmasi ko'rsatiladi"
    echo "   - beets/ va agents.md fayllarini yangilashingiz kerak"
else
    echo "❌ Xato: .git-hooks papkasi topilmadi!"
    exit 1
fi
