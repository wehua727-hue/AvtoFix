# Test Refund Validation - Simple Steps

## Test Product: SKU "105"
- **Name**: Вал ведущий заднего моста 4326
- **Current Stock**: 1
- **Initial Stock**: 6
- **Sold Quantity**: 5 (6-1=5)
- **Max Refundable**: 5

## Test Steps:

### 1. Switch to Refund Mode
1. Open Kassa page
2. Click "Qaytarish" button
3. You should see:
   - Orange "QAYTARISH REJIMI" banner at top
   - Success toast: "Qaytarish rejimiga o'tildi! Validation ishlaydi."
   - Blue test button (🧪) next to refund toggle

### 2. Test Notification System
1. Click the blue test button (🧪)
2. You should see:
   - Console logs about test event
   - Test notification about "Test mahsulot"
   - Direct toast: "Bu test xabari - agar ko'rsangiz, toast ishlaydi!"

### 3. Add Product to Cart
1. Type "105" in the numpad or search
2. Press OK or Enter
3. Product should be added to cart with quantity 0

### 4. Test Refund Limit
1. In the quantity input for SKU "105", type "6" (more than max 5)
2. You should see:
   - Console logs about refund validation
   - Error toast: "Вал ведущий заднего моста 4326 - boshlang'ich 6 ta, 5 ta sotilgan, 5 tadan ortiq qaytara olmaysiz!"
   - Quantity should NOT change (stays at previous value)

### 5. Test Valid Refund
1. Type "3" in quantity input (less than max 5)
2. Should work normally - quantity updates to 3
3. Stock display should show: 1 + 3 = 4 (stock after refund)

## Expected Console Logs:
```
[REFUND VALIDATION] Вал ведущий заднего моста 4326: stock=1, initialStock=6, sold=5, defective=0, maxReturn=5, requested=6
[REFUND VALIDATION] ❌ BLOCKED: Вал ведущий заднего моста 4326 - requested 6 > max 5
[REFUND VALIDATION] 🔔 Triggering notification for Вал ведущий заднего моста 4326
[REFUND VALIDATION] 🚀 Dispatching event with detail: {...}
[REFUND VALIDATION] ✅ Event dispatched successfully, result: true
[Kassa] 🔔 Refund limit exceeded event received: {...}
[Kassa] 📢 Showing refund limit toast: ...
[Kassa] ✅ Refund limit toast shown successfully
```

## If Notifications Don't Work:
1. Check browser console for errors
2. Try the test button (🧪) first
3. Make sure you're in refund mode (orange banner visible)
4. Check if toast library is loaded properly
5. Try refreshing the page

## Alternative Products to Test:
- SKU "111": Stock=1, InitialStock=6, MaxRefund=5
- SKU "112": Stock=1, InitialStock=6, MaxRefund=5
- SKU "121": Stock=1, InitialStock=6, MaxRefund=5
- SKU "125": Stock=1, InitialStock=6, MaxRefund=5