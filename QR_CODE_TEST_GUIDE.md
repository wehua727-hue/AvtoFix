# QR Code Testing Guide

## Quick Test Steps

### Test 1: Browser Print (Fastest)
1. Open Kassa page
2. Add any product to cart
3. Click "To'lov" (Payment button)
4. Select payment type (e.g., "Naqd")
5. Click "Chop etish" (Print button)
6. **Check**: Print preview should show QR code in check footer
7. **Verify**: QR code is black and white, 80x80 pixels
8. **Scan**: Use phone camera to scan QR code - should show "AVTOFIX-{receiptNumber}"

### Test 2: Console Logging
1. Open browser DevTools (F12)
2. Go to Console tab
3. Repeat Test 1
4. **Check**: Console should show:
   ```
   [POSPrint] Creating QR code: { qrContainerId: 'qrcode-CHK-001', qrText: 'AVTOFIX-CHK-001' }
   [POSPrint] QR code library loaded
   [POSPrint] QR container found: true
   [POSPrint] Creating QR code with text: AVTOFIX-CHK-001
   [POSPrint] QR code created successfully
   [POSPrint] Printing...
   [POSPrint] Closing print window
   ```

### Test 3: Offline Mode
1. Disconnect internet (or use DevTools to simulate offline)
2. Repeat Test 1
3. **Check**: QR code should still appear (fallback CDN or cached library)
4. **Verify**: No errors in console about CDN failures

### Test 4: Thermal Printer (XPRINTER)
1. Connect XPRINTER 58mm or 80mm printer
2. Open Kassa page
3. Go to Printer Settings
4. Select XPRINTER printer
5. Add product to cart
6. Click "To'lov" → "Chop etish"
7. **Check**: Check prints with QR code
8. **Verify**: QR code is readable by scanner

### Test 5: Refund Check
1. Enable refund mode (toggle button)
2. Add product to refund
3. Click "To'lov" → "Chop etish"
4. **Check**: Refund check prints with QR code
5. **Verify**: QR code content is "AVTOFIX-{receiptNumber}"

### Test 6: Defective Refund
1. Enable refund mode
2. Enable defective mode (checkbox)
3. Add product to defective refund
4. Click "To'lov" → "Chop etish"
5. **Check**: Defective refund check prints with QR code
6. **Verify**: Check header shows "YAROQSIZ QAYTARISH"

---

## Expected Results

### ✅ Success Indicators
- [ ] QR code appears in print preview
- [ ] QR code is black and white only
- [ ] QR code is 80x80 pixels
- [ ] QR code is readable by phone camera
- [ ] QR code content is "AVTOFIX-{receiptNumber}"
- [ ] Console shows all QR code logs
- [ ] No errors in console
- [ ] QR code prints on thermal printer
- [ ] QR code works in offline mode

### ❌ Failure Indicators
- [ ] QR code not visible in print preview
- [ ] QR code has colors (should be black and white)
- [ ] QR code is too small or too large
- [ ] QR code is not readable by scanner
- [ ] Console shows CDN errors
- [ ] QR code doesn't print on thermal printer
- [ ] QR code fails in offline mode

---

## Debugging

### If QR Code Not Appearing

**Step 1: Check Console**
```javascript
// Open DevTools Console and run:
console.log('QRCode Library:', window.QRCode);
console.log('QR Container:', document.getElementById('qrcode-CHK-001'));
```

**Step 2: Check Network**
- Open DevTools Network tab
- Look for qrcode.min.js requests
- Check if CDN is accessible
- Verify response status is 200

**Step 3: Check HTML**
- Open DevTools Elements tab
- Search for `qrcode-` in HTML
- Verify container div exists
- Check container has correct ID

**Step 4: Manual QR Code Creation**
```javascript
// In console, manually create QR code:
const container = document.getElementById('qrcode-CHK-001');
if (container && window.QRCode) {
  new QRCode(container, {
    text: 'AVTOFIX-CHK-001',
    width: 80,
    height: 80,
    colorDark: '#000000',
    colorLight: '#FFFFFF',
    correctLevel: QRCode.CorrectLevel.H,
  });
  console.log('QR code created manually');
}
```

### If CDN Not Loading

**Check Primary CDN**
```javascript
// In console:
fetch('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js')
  .then(r => console.log('Primary CDN:', r.status))
  .catch(e => console.log('Primary CDN Error:', e));
```

**Check Fallback CDN**
```javascript
// In console:
fetch('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js')
  .then(r => console.log('Fallback CDN:', r.status))
  .catch(e => console.log('Fallback CDN Error:', e));
```

---

## Performance Metrics

### Expected Timings
- QR code library load: 300-500ms
- QR code generation: 100-200ms
- Total print time: 2-3 seconds

### If Slow
1. Check internet connection
2. Check CDN response time
3. Check browser performance
4. Try different browser

---

## Browser DevTools Tips

### Chrome/Edge
1. Press F12 to open DevTools
2. Go to Console tab
3. Look for [POSPrint] logs
4. Check Network tab for CDN requests

### Firefox
1. Press F12 to open DevTools
2. Go to Console tab
3. Look for [POSPrint] logs
4. Check Network tab for CDN requests

### Safari
1. Enable Developer Menu (Preferences → Advanced)
2. Press Cmd+Option+I
3. Go to Console tab
4. Look for [POSPrint] logs

---

## Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| QR code not visible | CDN not loading | Check internet, try fallback CDN |
| QR code too small | Wrong size config | Check CSS, should be 80x80px |
| QR code not printing | Printer settings | Check print margins, quality |
| QR code has colors | CSS override | Check print styles, should be B&W |
| QR code not readable | Low quality | Increase error correction level |
| Print window closes too fast | Timing issue | Increase delay in code |
| QR code in wrong position | Layout issue | Check HTML structure |

---

## Verification Checklist

Before considering QR code implementation complete:

- [ ] QR code appears in browser print preview
- [ ] QR code is readable by phone camera
- [ ] QR code content is correct (AVTOFIX-{receiptNumber})
- [ ] QR code works in offline mode
- [ ] QR code prints on thermal printer
- [ ] QR code works for sales checks
- [ ] QR code works for refund checks
- [ ] QR code works for defective refund checks
- [ ] Console shows all expected logs
- [ ] No errors in console
- [ ] CDN fallback works if primary fails
- [ ] Print timing is reasonable (2-3 seconds)

---

## Support

If QR code is not working:

1. **Check Console**: Look for [POSPrint] logs
2. **Check Network**: Verify CDN is accessible
3. **Check HTML**: Verify container div exists
4. **Check Printer**: Verify printer is selected
5. **Check Browser**: Try different browser
6. **Check Internet**: Verify connection is stable

---

## Next Steps

After verifying QR code works:

1. Test with actual thermal printer
2. Test with different receipt numbers
3. Test with different payment types
4. Test with different products
5. Test in production environment
6. Gather user feedback
7. Monitor for issues

