#!/bin/bash

echo "🔍 Checking AvtoFix Production Status..."

echo "1. PM2 Status:"
pm2 status

echo -e "\n2. PM2 Logs (last 20 lines):"
pm2 logs avtofixshop --lines 20

echo -e "\n3. Checking if backend is running on port 5177:"
netstat -tlnp | grep :5177 || echo "❌ Port 5177 not listening"

echo -e "\n4. Testing API endpoint:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5177/api/health || echo "❌ API not responding"

echo -e "\n5. Checking nginx configuration:"
nginx -t

echo -e "\n6. Checking if dist folder exists:"
if [ -d "dist" ]; then
    echo "✅ dist folder exists"
    ls -la dist/ | head -10
else
    echo "❌ dist folder not found"
fi

echo -e "\n7. Checking environment file:"
if [ -f "dist/.env" ]; then
    echo "✅ Environment file exists in dist"
else
    echo "❌ Environment file not found in dist"
fi

echo -e "\n8. Disk space:"
df -h

echo -e "\n9. Memory usage:"
free -h