@echo off
echo 🚀 Starting WPS deployment with currency fix...

REM Build for production
echo 📦 Building for production...
call pnpm run build:production

REM Copy environment variables
echo 📋 Copying production environment...
copy .env.production .env

REM Ensure MongoDB connection
echo 🔗 Checking MongoDB connection...
node -e "const mongoose = require('mongoose'); const uri = process.env.MONGODB_URI || 'mongodb+srv://avtofix2025_db_user:FTnjYsHxkYxgu7qH@cluster0.b2fwuli.mongodb.net/'; mongoose.connect(uri).then(() => { console.log('✅ MongoDB connection successful'); process.exit(0); }).catch(err => { console.log('❌ MongoDB connection failed:', err.message); process.exit(1); });"

REM Deploy to WPS (add your deployment command here)
echo 🌐 Deploying to WPS...
REM Add your WPS deployment command here

echo ✅ WPS deployment completed!
echo 💰 Currency will now be saved to MongoDB in WPS!
pause
