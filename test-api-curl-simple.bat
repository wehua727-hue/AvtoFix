@echo off
echo Testing API with curl...
echo.

set userId=694a8cf599adb50cf1248e50
set userPhone=998914058481
set timestamp=%RANDOM%
set url="http://127.0.0.1:5174/api/products?userId=%userId%&userPhone=%userPhone%&limit=3&_t=%timestamp%&_nocache=true"

echo API URL: %url%
echo.

curl -s -H "Cache-Control: no-cache" %url% > api_test_response.json

echo Response saved to api_test_response.json
echo.
echo Checking for initialStock in response:
findstr /C:"initialStock" api_test_response.json

echo.
echo First 500 characters of response:
powershell -Command "Get-Content api_test_response.json -Raw | Select-Object -First 1 | ForEach-Object { $_.Substring(0, [Math]::Min(500, $_.Length)) }"

pause