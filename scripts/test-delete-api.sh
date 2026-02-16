#!/bin/bash

# DELETE API ni test qilish
# Bu script VPSdagi DELETE API ning ishlashini tekshiradi

echo "========================================="
echo "DELETE API Test"
echo "========================================="
echo ""

# VPS URL
API_URL="https://shop.avtofix.uz/api"

echo "1. Mahsulotlarni olish..."
curl -s "$API_URL/products?userId=697746478dc86ae74f75ad07" | jq '.[] | {id: ._id, name: .name, sku: .sku}' | head -20
echo ""

echo "2. Birinchi mahsulotni o'chirish (test)..."
PRODUCT_ID=$(curl -s "$API_URL/products?userId=697746478dc86ae74f75ad07" | jq -r '.[0]._id')
echo "Product ID: $PRODUCT_ID"
echo ""

echo "3. DELETE so'rovi yuborish..."
curl -X DELETE \
  -H "Content-Type: application/json" \
  -d '{"userRole":"egasi","canEditProducts":true}' \
  -v "$API_URL/products/$PRODUCT_ID"
echo ""

echo "4. Mahsulot o'chirilganini tekshirish..."
sleep 2
curl -s "$API_URL/products/$PRODUCT_ID" | jq '.'
echo ""

echo "========================================="
echo "Test tugadi"
echo "========================================="
