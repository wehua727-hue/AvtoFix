@echo off
echo Testing API directly with curl...
echo.

set userId=693d2d63ba2fae9ff378c33a
set userPhone=998914058481
set timestamp=%RANDOM%
set url=http://127.0.0.1:5174/api/products?userId=%userId%^&userPhone=%userPhone%^&limit=5^&_t=%timestamp%^&_nocache=true

echo API URL: %url%
echo.

curl -H "Cache-Control: no-cache, no-store, must-revalidate, max-age=0" -H "Pragma: no-cache" -H "Expires: 0" "%url%" > api_response.json

echo.
echo Response saved to api_response.json
echo.
echo First few lines of response:
type api_response.json | findstr /C:"initialStock" | head -5

pause