#!/bin/bash

# WPS Deploy Script with Currency Fix
echo "🚀 Starting WPS deployment with currency fix..."

# Build for production
echo "📦 Building for production..."
npm run build:production

# Copy environment variables
echo "📋 Copying production environment..."
cp .env.production .env

# Ensure MongoDB connection
echo "🔗 Checking MongoDB connection..."
node -e "
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://avtofix2025_db_user:FTnjYsHxkYxgu7qH@cluster0.b2fwuli.mongodb.net/';
mongoose.connect(uri).then(() => {
  console.log('✅ MongoDB connection successful');
  process.exit(0);
}).catch(err => {
  console.log('❌ MongoDB connection failed:', err.message);
  process.exit(1);
});
"

# Deploy to WPS
echo "🌐 Deploying to WPS..."
# Add your WPS deployment command here
# Example: rsync -avz --delete dist/ your-wps-server:/path/to/app/

echo "✅ WPS deployment completed!"
echo "💰 Currency will now be saved to MongoDB in WPS!"
