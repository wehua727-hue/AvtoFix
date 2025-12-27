@echo off
echo Testing API for initialStock values...
curl -H "Cache-Control: no-cache" -H "Pragma: no-cache" "http://127.0.0.1:5175/api/products?userId=694a8cf599adb50cf1248e50&userPhone=998914058481&limit=5&_t=%time%" > api_response_initialstock.json
echo.
echo Response saved to api_response_initialstock.json
echo.
echo Checking for SKU "1" product...
findstr /C:"\"sku\":\"1\"" api_response_initialstock.json
findstr /C:"\"sku\":1" api_response_initialstock.json
echo.
echo Checking for initialStock fields...
findstr /C:"initialStock" api_response_initialstock.json
pause