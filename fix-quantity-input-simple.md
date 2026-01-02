# Sodda Yechim: QuantityInput ni Almashtirish

## Muammo
- QuantityInput hali ham default qiymat ko'rsatmoqda
- Murakkab useEffect va state management

## Sodda Yechim
QuantityInput komponentini butunlay sodda versiya bilan almashtirish:

```typescript
function QuantityInput({ value, onChange }: { value: number; onChange: (val: number) => void }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="Soni"
      defaultValue="" // Har doim bo'sh
      onChange={(e) => {
        const val = parseInt(e.target.value) || 0;
        onChange(val);
      }}
      onFocus={(e) => e.target.value = ''} // Focus bo'lganda tozalash
      onBlur={(e) => e.target.value = ''} // Blur bo'lganda tozalash
      className="w-16 sm:w-20 lg:w-24 h-6 sm:h-7 lg:h-8 text-center text-xs sm:text-sm font-bold text-slate-200 bg-slate-700/80 border border-slate-600/50 rounded-lg sm:rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
    />
  );
}
```

## Xususiyatlar
- ✅ Har doim bo'sh placeholder
- ✅ defaultValue=""
- ✅ Focus/blur da tozalash
- ✅ Sodda va ishonchli