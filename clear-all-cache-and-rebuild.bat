@echo off
echo 🧹 Clearing all cache and rebuilding...

echo.
echo 📦 Clearing npm cache...
npm cache clean --force

echo.
echo 🗑️ Removing node_modules...
rmdir /s /q node_modules 2>nul

echo.
echo 🗑️ Removing dist/build folders...
rmdir /s /q dist 2>nul
rmdir /s /q build 2>nul
rmdir /s /q client\dist 2>nul
rmdir /s /q server\dist 2>nul

echo.
echo 📥 Installing dependencies...
pnpm install

echo.
echo 🔨 Building project...
pnpm run build

echo.
echo ✅ Done! Cache cleared and project rebuilt.
echo 💡 Now refresh your browser with Ctrl+F5 to clear browser cache too.
pause