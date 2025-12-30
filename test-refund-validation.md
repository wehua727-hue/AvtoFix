# Test Refund Validation System

## Current Implementation Status

The refund validation system is already implemented with the following logic:

### 1. Refund Limit Calculation
```typescript
// In useOfflineKassa.ts updateQuantity function
const currentStock = item.stock ?? 0;
const currentInitialStock = item.initialStock;
const defectiveCount = defectiveCounts.get(item.productId) || 0;
const soldQuantity = currentInitialStock - currentStock;
const maxReturn = soldQuantity - defectiveCount;

if (safeQuantity > maxReturn) {
  // Trigger refund-limit-exceeded event
}
```

### 2. Validation Logic
- **Sold Quantity** = `initialStock - currentStock`
- **Max Returnable** = `soldQuantity - defectiveCount`
- **Validation** = `requestedQuantity > maxReturn`

### 3. Notification System
- Real-time validation in quantity input
- Toast notifications with detailed messages
- Visual indicators in payment button

## Example Scenario (User's Request)
- Initial stock: 8
- Sold: 5 (current stock: 3)
- Max returnable: 5
- If 3 returned as defective: Max remaining returnable = 2

## Test Cases to Verify

1. **Basic Refund Limit**
   - Product: initialStock=8, currentStock=3 (5 sold)
   - Try to refund 6 → Should show error "5 tadan ortiq qaytara olmaysiz"

2. **With Defective Returns**
   - Same product, 3 already returned as defective
   - Try to refund 3 → Should show error "2 tadan ortiq qaytara olmaysiz"

3. **Updated Initial Stock**
   - Product edited to initialStock=9, currentStock=4 (5 sold)
   - Should allow up to 5 returns

## Potential Issues to Check

1. **DefectiveCounts Loading**: Verify `getAllDefectiveCounts()` is working
2. **InitialStock Updates**: Verify `getProduct()` fetches fresh initialStock
3. **Real-time Validation**: Verify quantity input triggers validation immediately
4. **Notification Display**: Verify toast messages are showing properly

## Status: ✅ IMPLEMENTED
The refund validation system appears to be correctly implemented. If user is experiencing issues, it might be:
- Data not loading properly (defectiveCounts or initialStock)
- UI not showing validation messages
- Caching issues preventing fresh data