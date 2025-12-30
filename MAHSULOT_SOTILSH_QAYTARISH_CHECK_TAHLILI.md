# Mahsulot Sotilsh Paytida Qaytarish Qismida Check Chiqarilishi - TAHLIL

## 📋 UMUMIY JARAYON

Mahsulot sotilganda va qaytarish rejimida check qanday chiqarilayotgani:

```
1. SOTISH JARAYONI
   ├─ Mahsulot qo'shiladi (SKU orqali qidiruv)
   ├─ Miqdor kiritiladi
   ├─ Narx ko'rsatiladi
   ├─ "To'lov" tugmasi bosiladi
   └─ Sale ma'lumotlari saqlanadi

2. SALE MA'LUMOTLARI SAQLANISHI
   ├─ setSalesHistory ga qo'shiladi
   ├─ Sale object:
   │  ├─ id: UUID
   │  ├─ items: [{name, sku, quantity, price, discount}]
   │  ├─ total: raqam
   │  ├─ date: timestamp
   │  ├─ paymentType: "Naqd" | "Karta" | "O'tkazma"
   │  ├─ type: "sale" | "refund"
   │  └─ synced: boolean
   └─ localStorage ga saqlanadi

3. TARIX PANELIDA CHECK KO'RSATILISHI
   ├─ Tarix paneli ochiladi (History tugmasi)
   ├─ Sana bo'yicha guruhlash
   ├─ Har bir sale uchun:
   │  ├─ Mahsulot nomlari (birinchi 2 ta)
   │  ├─ Vaqt
   │  ├─ To'lov turi (icon)
   │  ├─ Summa
   │  └─ Synced status
   └─ Sale tanlansa - detail dialog ochiladi

4. DETAIL DIALOG DA CHECK CHIQARILISHI
   ├─ Sale header:
   │  ├─ Chek/Qaytarish sarlavhasi
   │  ├─ Sana va vaqt
   │  └─ Synced status
   ├─ Mahsulotlar jadvali:
   │  ├─ Mahsulot nomi
   │  ├─ Miqdor
   │  └─ Narx
   ├─ Jami summa
   └─ "Chekni chop etish" tugmasi
```

---

## 🔍 KASSA.TSX DA CHECK CHIQARILISH LOGIKASI

### 1. SALE MA'LUMOTLARI SAQLANISHI (Sotish paytida)

**Fayl**: `client/pages/Kassa.tsx` (lines 959-1002)

```typescript
// Oddiy sotuv yoki yaroqli qaytarish
const sale = await completeSale(paymentType, isRefundMode ? "refund" : "sale");

if (sale) {
  setSalesHistory((prev) => [{
    id: sale.id,
    items: sale.items,
    total: sale.total,
    date: new Date().toISOString(),
    paymentType: paymentType,
    type: isRefundMode ? "refund" : "sale",
    synced: false,
  }, ...prev]);
```

**Sale object struktura**:
- `id`: Unique identifier (UUID)
- `items`: Mahsulotlar massivi
  - `name`: Mahsulot nomi
  - `sku`: SKU kodi
  - `quantity`: Miqdor
  - `price`: Narx
  - `discount`: Chegirma
- `total`: Jami summa
- `date`: ISO timestamp
- `paymentType`: To'lov turi
- `type`: "sale" yoki "refund"
- `synced`: Server ga yuborilganmi?

---

### 2. TARIX PANELIDA CHECK KO'RSATILISHI

**Fayl**: `client/pages/Kassa.tsx` (lines 1680-1750)

#### A. Sana bo'yicha guruhlash

```typescript
const grouped: Record<string, SaleHistory[]> = {};
filteredHistory.forEach((sale) => {
  const dateKey = new Date(sale.date).toLocaleDateString("ru-RU");
  if (!grouped[dateKey]) grouped[dateKey] = [];
  grouped[dateKey].push(sale);
});
```

**Natija**: Sana bo'yicha guruhlangan sale massivi

#### B. Har bir sale uchun card ko'rsatilishi

```typescript
{sales.map((sale, idx) => {
  const PaymentIcon = sale.paymentType === "Naqd" ? Banknote : ...;
  const isRefund = sale.type === "refund";
  
  // Mahsulot nomlari - birinchi 2 tasini ko'rsatish
  const productNames = sale.items.map(item => item.name);
  const displayNames = productNames.slice(0, 2).join(", ");
  const moreCount = productNames.length > 2 ? productNames.length - 2 : 0;
  
  return (
    <div
      className={`p-4 border rounded-2xl cursor-pointer transition-all 
        ${isRefund ? "border-red-500/40 bg-red-900/20" : "border-slate-700/50 bg-slate-800/30"}`}
      onClick={() => setSelectedSale(sale)}
    >
      {/* Mahsulot nomlari */}
      <div className={`text-sm font-medium mb-2 truncate 
        ${isRefund ? "text-red-300" : "text-slate-300"}`}>
        {displayNames}
        {moreCount > 0 && <span className="text-slate-500 ml-1">+{moreCount} ta</span>}
      </div>
      
      {/* Chek raqami, vaqt, to'lov turi, summa */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          {isRefund && <RotateCcw className="w-4 h-4 text-red-500" />}
          <span className={`font-bold ${isRefund ? "text-red-400" : "text-slate-200"}`}>
            #{idx + 1}
          </span>
          <span className="text-slate-500 text-sm">
            {new Date(sale.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <PaymentIcon className={`w-4 h-4 ${isRefund ? "text-red-400" : "text-slate-400"}`} />
          {!sale.synced && <CloudOff className="w-3 h-3 text-amber-500" />}
        </div>
        <span className={`text-xl font-black ${isRefund ? "text-red-500" : "text-green-500"}`}>
          <span className="text-green-400 mr-1">$</span>
          {isRefund ? "-" : ""}{formatNum(sale.total)}
        </span>
      </div>
    </div>
  );
})}
```

**Ko'rsatilayotgan ma'lumotlar**:
- ✅ Mahsulot nomlari (birinchi 2 ta + qolgan soni)
- ✅ Chek raqami (#1, #2, ...)
- ✅ Vaqt (HH:MM)
- ✅ To'lov turi (icon)
- ✅ Synced status (agar synced bo'lmasa - CloudOff icon)
- ✅ Summa (qaytarish bo'lsa "-" belgisi bilan)

---

### 3. DETAIL DIALOG DA CHECK CHIQARILISHI

**Fayl**: `client/pages/Kassa.tsx` (lines 1750-1850)

#### A. Dialog header

```typescript
<div className="px-6 py-5 border-b border-slate-700/50 bg-gradient-to-r from-red-900/30 to-transparent">
  <div className="flex items-center gap-4">
    <div className={`p-3 rounded-2xl 
      ${selectedSale?.type === "refund" ? "bg-red-500/20 border border-red-500/30" : "bg-emerald-500/20 border border-emerald-500/30"}`}>
      {selectedSale?.type === "refund" ? 
        <RotateCcw className="w-6 h-6 text-red-400" /> : 
        <CreditCard className="w-6 h-6 text-emerald-400" />
      }
    </div>
    <div>
      <h2 className="text-xl font-black text-white flex items-center gap-2">
        {selectedSale?.type === "refund" ? "Qaytarish" : "Chek"}
        {selectedSale && !selectedSale.synced && <CloudOff className="w-4 h-4 text-amber-500" />}
      </h2>
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <span>{selectedSale && new Date(selectedSale.date).toLocaleDateString("ru-RU")}</span>
        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
        <span>{selectedSale && new Date(selectedSale.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  </div>
</div>
```

**Ko'rsatilayotgan ma'lumotlar**:
- ✅ Chek/Qaytarish sarlavhasi
- ✅ Sana (DD.MM.YYYY)
- ✅ Vaqt (HH:MM)
- ✅ Synced status

#### B. Mahsulotlar jadvali

```typescript
<div className="border border-slate-700/50 rounded-2xl overflow-hidden bg-slate-800/30">
  <div className="bg-slate-900/60 px-5 py-4 border-b border-slate-700/50">
    <div className="grid grid-cols-[1fr_80px_110px] gap-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
      <div>Mahsulot</div>
      <div className="text-center">Soni</div>
      <div className="text-right">Narxi</div>
    </div>
  </div>
  <div className="max-h-[40vh] overflow-auto">
    {selectedSale.items.map((item, i) => (
      <div key={i} className="grid grid-cols-[1fr_80px_110px] gap-3 px-5 py-4 border-b border-slate-700/30 hover:bg-slate-700/20">
        <div className="text-sm text-slate-200 truncate font-medium">{item.name}</div>
        <div className="text-center">
          <span className="px-3 py-1.5 rounded-xl bg-slate-700/50 text-sm text-slate-300 font-bold">
            {item.quantity}
          </span>
        </div>
        <div className="text-right text-sm text-slate-300 font-medium">
          {formatNum((item.quantity || 0) * (item.price || 0))}
        </div>
      </div>
    ))}
  </div>
  <div className="bg-slate-900/60 px-5 py-5 border-t border-slate-700/50">
    <div className="flex justify-between items-center">
      <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Jami:</span>
      <span className={`text-2xl font-black 
        ${selectedSale.type === "refund" ? "text-red-500" : "text-green-500"}`}>
        <span className="text-green-400 mr-1">$</span>
        {selectedSale.type === "refund" ? "-" : ""}
        {formatNum(selectedSale.total)}
      </span>
    </div>
  </div>
</div>
```

**Ko'rsatilayotgan ma'lumotlar**:
- ✅ Mahsulot nomi
- ✅ Miqdor (badge da)
- ✅ Narx (quantity × price)
- ✅ Jami summa (qaytarish bo'lsa "-" belgisi bilan)

#### C. Chop etish tugmasi

```typescript
<Button
  className="w-full h-14 gap-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-lg"
  onClick={async () => {
    setIsPrinting(true);
    try {
      const receiptData: ReceiptData = {
        type: selectedSale.type || "sale",
        items: selectedSale.items.map((item: any) => ({ 
          name: item.name, 
          sku: item.sku,
          quantity: item.quantity, 
          price: item.price, 
          discount: item.discount 
        })),
        total: selectedSale.total,
        paymentType: selectedSale.paymentType || "Naqd",
        cashier: user?.name,
        date: new Date(selectedSale.date),
        receiptNumber: selectedSale.id,
        // Do'kon ma'lumotlari
        storeName: storeInfo.storeName,
        storeAddress: storeInfo.storeAddress,
        storePhone: storeInfo.storePhone,
      };
      await printReceipt(selectedPrinter, receiptData);
    } catch (e) { 
      console.error("Print error:", e); 
    } finally { 
      setIsPrinting(false); 
    }
  }}
  disabled={isPrinting}
>
  {isPrinting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Printer className="w-6 h-6" />}
  Chekni chop etish
</Button>
```

**Chop etish jarayoni**:
1. ReceiptData object yaratiladi
2. printReceipt() funksiyasi chaqiriladi
3. Printer orqali chek chop etiladi

---

## 📊 CHECK CHIQARILISH JARAYONI - DIAGRAMMA

```
┌─────────────────────────────────────────────────────────────┐
│                    SOTISH JARAYONI                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Mahsulot qo'shish (SKU orqali)                         │
│     ↓                                                       │
│  2. Miqdor kiritish                                        │
│     ↓                                                       │
│  3. "To'lov" tugmasi → Payment Dialog                      │
│     ↓                                                       │
│  4. To'lov turi tanlash (Naqd/Karta/O'tkazma)             │
│     ↓                                                       │
│  5. completeSale() → Sale object yaratiladi                │
│     ↓                                                       │
│  6. setSalesHistory() → Sale saqlanadi                     │
│     ↓                                                       │
│  7. printReceipt() → Chek chop etiladi                     │
│     ↓                                                       │
│  8. Cart tozalanadi, rejim qayta o'zgartiriladi            │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  CHECK KO'RSATILISHI                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. History tugmasi → Tarix paneli ochiladi                │
│     ↓                                                       │
│  2. Sana bo'yicha guruhlash                                │
│     ↓                                                       │
│  3. Har bir sale uchun card:                               │
│     - Mahsulot nomlari (birinchi 2 ta)                     │
│     - Chek raqami                                          │
│     - Vaqt                                                 │
│     - To'lov turi                                          │
│     - Summa                                                │
│     ↓                                                       │
│  4. Sale tanlansa → Detail Dialog                          │
│     ↓                                                       │
│  5. Detail Dialog da:                                      │
│     - Chek/Qaytarish sarlavhasi                            │
│     - Sana va vaqt                                         │
│     - Mahsulotlar jadvali                                  │
│     - Jami summa                                           │
│     - Chop etish tugmasi                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 QAYTARISH REJIMIDA CHECK CHIQARILISHI

### Qaytarish rejimi qanday ishlaydi?

1. **Qaytarish tugmasi bosiladi**
   ```typescript
   onClick={() => {
     setIsRefundMode(true);
     refreshCache();
   }}
   ```

2. **Rejim o'zgaradi**
   - Header: Apelsin rang ("Qaytarish rejimi")
   - Total card: Apelsin rang ("Qaytarish:")
   - Tugmalar: Apelsin rang

3. **Mahsulot qo'shish**
   - Eski chekdan mahsulot tanlash
   - Yoki SKU orqali qidiruv

4. **Yaroqli/Yaroqsiz switch**
   - Yaroqli qaytarish: Stock oshadi
   - Yaroqsiz qaytarish: Stock o'zgarmaydi, defectiveProducts ga qo'shiladi

5. **To'lov**
   - completeSale() chaqiriladi
   - type: "refund" bilan sale saqlanadi
   - Tarixda qizil rang bilan ko'rsatiladi

---

## 💾 SALE MA'LUMOTLARI SAQLANISHI

### localStorage da saqlanishi

```typescript
// Kassa.tsx da
const [salesHistory, setSalesHistory] = useState<SaleHistory[]>([]);

// useEffect da localStorage ga saqlanadi
useEffect(() => {
  localStorage.setItem('salesHistory', JSON.stringify(salesHistory));
}, [salesHistory]);
```

### SaleHistory interface

```typescript
interface SaleHistory {
  id: string;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    price: number;
    discount?: number;
  }>;
  total: number;
  date: string; // ISO timestamp
  paymentType: "Naqd" | "Karta" | "O'tkazma";
  type: "sale" | "refund";
  synced: boolean;
}
```

---

## 🎯 XULOSA

**Mahsulot sotilganda qaytarish qismida check chiqarilishi jarayoni**:

1. ✅ **Sotish paytida**: Sale object yaratiladi va setSalesHistory ga qo'shiladi
2. ✅ **Tarix panelida**: Sana bo'yicha guruhlangan sale cardlari ko'rsatiladi
3. ✅ **Detail dialogda**: Tanlangan sale ning mahsulotlari, narxlari va jami summasi ko'rsatiladi
4. ✅ **Chop etishda**: printReceipt() orqali chek chop etiladi
5. ✅ **Qaytarish rejimida**: Shu xuddi jarayon takrorlanadi, lekin type: "refund" bilan

**Muhim nuqtalar**:
- Sale ma'lumotlari localStorage da saqlanadi
- Tarixda sana bo'yicha guruhlash
- Qaytarish bo'lsa qizil rang, sotish bo'lsa yashil rang
- Synced status ko'rsatiladi
- Chop etish uchun printReceipt() funksiyasi ishlatiladi


---

## 🚚 TRUCK SVG QOSHILISHI

### Qo'shilgan joylar:

1. **Tarix panelida check cardlarining teppasiga**
   - Har bir check cardining teppasida truck SVG ko'rsatiladi
   - Qaytarish bo'lsa qizil rang, sotish bo'lsa shifer rang
   - Size: 32x32px

2. **Detail dialog headerida**
   - Check detaillarini ochganda teppasida truck SVG ko'rsatiladi
   - Size: 48x48px
   - Markazlashtirilgan

### SVG struktura:

```typescript
<svg width="32" height="32" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  {/* Truck body */}
  {/* Truck cabin */}
  {/* Wheels (3 ta) */}
  {/* Cabin window */}
  {/* Door line */}
</svg>
```

### Rang tanlovi:

- **Sotish**: `text-slate-400` (shifer rang)
- **Qaytarish**: `text-red-400` (qizil rang)

### Fayl joylashuvi:

- SVG kod: `client/pages/Kassa.tsx` (inline SVG)
- SVG fayl: `public/truck-icon.svg` (backup)

---

## 📝 IMPLEMENTATSIYA XULOSA

**Mahsulot sotilsh va qaytarish chekining teppasiga truck SVG qo'shildi:**

1. ✅ Tarix panelida har bir check cardining teppasida truck SVG
2. ✅ Detail dialog headerida truck SVG
3. ✅ Rang tanlovi: sotish (shifer), qaytarish (qizil)
4. ✅ Responsive design (32px va 48px)
5. ✅ Inline SVG (performance uchun)

**Natija**: Cheklar endi truck SVG bilan ko'rsatiladi, bu do'kon/transport mavzusini ta'kidlaydi.
