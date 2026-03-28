#!/bin/bash

echo "🚀 Deploying AvtoFix to Production..."

# 1. Build the application
echo "🏗️ Building application..."
npm run build

# 2. Stop existing PM2 process
echo "🛑 Stopping existing PM2 process..."
pm2 stop avtofixshop || echo "No existing process found"
pm2 delete avtofixshop || echo "No existing process to delete"

# 3. Copy environment file
echo "📋 Setting up environment..."
cp .env.production dist/.env

# 4. Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# 5. Start PM2 process
echo "🚀 Starting PM2 process..."
pm2 start ecosystem.config.cjs

# 6. Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# 7. Show status
echo "📊 PM2 Status:"
pm2 status

echo "✅ Deployment completed!"
echo "🔗 Site: https://shop.avtofix.uz"
echo "📊 Monitor: pm2 monit"
echo "📝 Logs: pm2 logs avtofixshop"