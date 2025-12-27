import { useState, useEffect, useCallback } from 'react';

/**
 * CurrencyPriceInput Component
 * 
 * A reusable component for handling price input with USD/UZS currency selection
 * and automatic conversion using today's exchange rate.
 * 
 * Features:
 * - Currency selection dropdown (USD/UZS)
 * - Automatic input cleaning (removes currency symbols)
 * - Real-time USD → UZS conversion
 * - Proper formatting and display
 * - Returns clean numeric value and currency type
 */

// API base URL - same logic as in Products.tsx
const API_BASE_URL = (() => {
  if (typeof window === 'undefined') return '';
  
  // Electron (file://) uchun - port 5174
  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:5174';
  }
  
  // Production yoki development - relative URL ishlatamiz (same origin)
  const envApiUrl = import.meta.env.VITE_API_BASE_URL;
  
  // Placeholder yoki noto'g'ri qiymatlarni tekshirish
  const isPlaceholder = envApiUrl && (
    envApiUrl.includes('YOUR_PUBLIC_IP') || 
    envApiUrl.includes('your_public_ip') ||
    envApiUrl.includes('localhost') && window.location.protocol === 'https:'
  );
  
  // Agar HTTPS sahifada HTTP API URL bo'lsa, mixed content xatosi bo'ladi
  const isHttpOnHttps = envApiUrl && 
    envApiUrl.startsWith('http://') && 
    window.location.protocol === 'https:';
  
  if (envApiUrl && !isPlaceholder && !isHttpOnHttps) {
    return envApiUrl;
  }
  
  // Default: same origin (relative URL) - HTTPS sahifalar uchun xavfsiz
  return '';
})();

export type Currency = 'USD' | 'UZS' | 'RUB' | 'CNY';

interface CurrencyPriceInputProps {
  /** Current price value (as string for input) */
  value: string;
  /** Callback when price or currency changes */
  onChange: (price: string, currency: Currency) => void;
  /** Initial currency (default: 'UZS') */
  initialCurrency?: Currency;
  /** Input placeholder override */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Label text */
  label?: string;
}

/**
 * Clean price input - removes currency symbols and returns numeric string
 * Handles: "$10", "10$", "10 $", "150000 uzs", "150000 so'm", etc.
 * Supports both comma (,) and dot (.) as decimal separator
 */
function cleanPrice(value: string): string {
  if (!value) return '';
  
  // Remove all currency symbols and text
  let cleaned = value
    .replace(/\$/g, '')           // Remove $ symbol
    .replace(/uzs/gi, '')         // Remove "uzs" (case insensitive)
    .replace(/so['']m/gi, '')     // Remove "so'm" or "so'm"
    .replace(/usd/gi, '')         // Remove "usd" (case insensitive)
    .replace(/\s+/g, '')          // Remove all whitespace
    .trim();
  
  // Vergulni nuqtaga almashtirish (iPhone va boshqa qurilmalar uchun)
  // Avval ming ajratuvchi vergullarni aniqlash kerak
  // Agar verguldan keyin 3 ta raqam bo'lsa - bu ming ajratuvchi
  // Agar verguldan keyin 1-2 ta raqam bo'lsa - bu o'nlik ajratuvchi
  
  // Oddiy holat: faqat bitta vergul yoki nuqta bor
  const commaCount = (cleaned.match(/,/g) || []).length;
  const dotCount = (cleaned.match(/\./g) || []).length;
  
  if (commaCount === 1 && dotCount === 0) {
    // Faqat bitta vergul bor - bu o'nlik ajratuvchi bo'lishi mumkin
    const afterComma = cleaned.split(',')[1];
    if (afterComma && afterComma.length <= 2) {
      // 1 yoki 2 ta raqam - bu o'nlik (1,5 yoki 1,50)
      cleaned = cleaned.replace(',', '.');
    } else {
      // 3+ ta raqam - bu ming ajratuvchi (1,000)
      cleaned = cleaned.replace(',', '');
    }
  } else if (commaCount > 1) {
    // Ko'p vergul - bular ming ajratuvchilar
    cleaned = cleaned.replace(/,/g, '');
  } else if (commaCount === 1 && dotCount >= 1) {
    // Vergul va nuqta bor - vergul ming ajratuvchi
    cleaned = cleaned.replace(/,/g, '');
  }
  
  // Only keep numbers and decimal point
  cleaned = cleaned.replace(/[^\d.]/g, '');
  
  // Ensure only one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  
  return cleaned;
}

/**
 * Format number with thousand separators
 */
function formatNumber(value: string): string {
  if (!value) return '';
  
  const cleaned = cleanPrice(value);
  if (!cleaned) return '';
  
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num)) return '';
  
  // Format with thousand separators
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function CurrencyPriceInput({
  value,
  onChange,
  initialCurrency = 'UZS',
  placeholder,
  className = '',
  disabled = false,
  label,
}: CurrencyPriceInputProps) {
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [inputValue, setInputValue] = useState<string>(value || '');
  const [exchangeRates, setExchangeRates] = useState<{ usd: number; rub: number; cny: number } | null>(null);
  const [convertedPrice, setConvertedPrice] = useState<number | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);

  // Fetch exchange rates from backend (USD, RUB, CNY)
  // Kurs har kuni ertalab Markaziy banklar tomonidan yangilanadi,
  // shuning uchun har soat yangilaymiz va kun o'zgarganda avtomatik yangi kurs olinadi
  useEffect(() => {
    let isMounted = true;
    
    const fetchExchangeRates = async () => {
      setIsLoadingRate(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/currency/rates`);
        if (!response.ok) {
          console.error('[CurrencyPriceInput] Failed to fetch exchange rates');
          return;
        }
        
        const data = await response.json();
        if (isMounted && data.success && data.rates) {
          setExchangeRates(data.rates);
          console.log(`[CurrencyPriceInput] Exchange rates loaded: USD=${data.rates.usd}, RUB=${data.rates.rub}, CNY=${data.rates.cny} (date: ${data.date || 'N/A'})`);
        }
      } catch (error) {
        console.error('[CurrencyPriceInput] Error fetching exchange rates:', error);
      } finally {
        if (isMounted) {
          setIsLoadingRate(false);
        }
      }
    };

    // Dastlabki yuklash
    fetchExchangeRates();

    // Har soat yangilash (3600000 ms = 1 hour)
    // Bu kurs har kuni ertalab yangilanishini ta'minlaydi
    const interval = setInterval(() => {
      console.log('[CurrencyPriceInput] Refreshing exchange rates (hourly update)...');
      fetchExchangeRates();
    }, 60 * 60 * 1000); // 1 hour

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Update input value when external value prop changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Update currency when initialCurrency prop changes
  useEffect(() => {
    setCurrency(initialCurrency);
  }, [initialCurrency]);

  // Calculate converted price when input or currency changes
  useEffect(() => {
    if (!inputValue || !exchangeRates) {
      setConvertedPrice(null);
      return;
    }

    const cleaned = cleanPrice(inputValue);
    if (!cleaned) {
      setConvertedPrice(null);
      return;
    }

    const numValue = parseFloat(cleaned);
    if (!Number.isFinite(numValue) || numValue <= 0) {
      setConvertedPrice(null);
      return;
    }

    // Convert to UZS based on selected currency
    if (currency === 'USD') {
      setConvertedPrice(numValue * exchangeRates.usd);
    } else if (currency === 'RUB') {
      setConvertedPrice(numValue * exchangeRates.rub);
    } else if (currency === 'CNY') {
      setConvertedPrice(numValue * exchangeRates.cny);
    } else {
      // UZS - show USD equivalent
      setConvertedPrice(numValue / exchangeRates.usd);
    }
  }, [inputValue, currency, exchangeRates]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const cleaned = cleanPrice(rawValue);
    
    setInputValue(cleaned);
    onChange(cleaned, currency);
  }, [currency, onChange]);

  // Handle currency change
  const handleCurrencyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = e.target.value as Currency;
    setCurrency(newCurrency);
    
    // Notify parent of currency change (price stays the same, but currency changes)
    onChange(inputValue, newCurrency);
  }, [inputValue, onChange]);

  // Get placeholder text based on currency
  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    switch (currency) {
      case 'USD': return 'Price in USD';
      case 'RUB': return 'Narx (RUB)';
      case 'CNY': return 'Narx (CNY)';
      default: return 'Narx (UZS)';
    }
  };

  // Get currency symbol for display
  const getCurrencySymbol = () => {
    switch (currency) {
      case 'USD': return '$';
      case 'RUB': return '₽';
      case 'CNY': return '¥';
      default: return 'UZS';
    }
  };

  // Format converted price for display
  const formatConvertedPrice = (price: number | null): string => {
    if (price === null || !Number.isFinite(price)) return '';
    
    const formatted = price.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    
    return currency === 'UZS' ? `$${formatted}` : `${formatted} UZS`;
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-foreground mb-1.5">
          {label}
        </label>
      )}
      
      <div className="flex flex-col gap-3">
        {/* Currency selector and input row - Enhanced Modern Design */}
        <div className="flex gap-2.5">
          {/* Currency selector - Enhanced with icons */}
          <div className="relative group">
            <select
              value={currency}
              onChange={handleCurrencyChange}
              disabled={disabled}
              className={`appearance-none px-3.5 py-2.5 pr-8 rounded-xl font-bold text-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[95px] cursor-pointer transition-all shadow-lg ${
                currency === 'USD'
                  ? 'bg-gradient-to-br from-green-600 via-green-700 to-green-600 hover:from-green-500 hover:via-green-600 hover:to-green-500 border-2 border-green-500/60 focus:ring-green-400 focus:border-green-400 shadow-green-900/40'
                  : currency === 'RUB'
                  ? 'bg-gradient-to-br from-purple-600 via-purple-700 to-purple-600 hover:from-purple-500 hover:via-purple-600 hover:to-purple-500 border-2 border-purple-500/60 focus:ring-purple-400 focus:border-purple-400 shadow-purple-900/40'
                  : currency === 'CNY'
                  ? 'bg-gradient-to-br from-red-600 via-red-700 to-red-600 hover:from-red-500 hover:via-red-600 hover:to-red-500 border-2 border-red-500/60 focus:ring-red-400 focus:border-red-400 shadow-red-900/40'
                  : 'bg-gradient-to-br from-blue-600 via-blue-700 to-blue-600 hover:from-blue-500 hover:via-blue-600 hover:to-blue-500 border-2 border-blue-500/60 focus:ring-blue-400 focus:border-blue-400 shadow-blue-900/40'
              }`}
            >
              <option value="USD" className="bg-gray-800 text-white">USD ($)</option>
              <option value="RUB" className="bg-gray-800 text-white">RUB (₽)</option>
              <option value="CNY" className="bg-gray-800 text-white">CNY (¥)</option>
              <option value="UZS" className="bg-gray-800 text-white">UZS</option>
            </select>
            {/* Custom dropdown arrow */}
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {/* Currency icon indicator */}
            <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${
              currency === 'USD' ? 'bg-green-500' : currency === 'RUB' ? 'bg-purple-500' : currency === 'CNY' ? 'bg-red-500' : 'bg-blue-500'
            }`}>
              <span className="text-[8px] font-bold text-white">
                {getCurrencySymbol()}
              </span>
            </div>
          </div>

          {/* Price input with currency symbol - Enhanced Design */}
          <div className="relative flex-1 group">
            <input
              type="text"
              value={formatNumber(inputValue)}
              onChange={handleInputChange}
              placeholder={getPlaceholder()}
              disabled={disabled}
              className="w-full px-4 py-2.5 pr-20 bg-background border-2 border-input text-sm text-foreground placeholder-muted-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed group-hover:border-primary/50"
            />
            {/* Currency symbol badge on the right - Enhanced */}
            <div className={`absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg font-extrabold text-xs pointer-events-none transition-all flex items-center gap-1 ${
              currency === 'USD' 
                ? 'bg-gradient-to-br from-green-600 via-green-700 to-green-600 text-white shadow-lg shadow-green-900/40 border border-green-500/50'
                : currency === 'RUB'
                ? 'bg-gradient-to-br from-purple-600 via-purple-700 to-purple-600 text-white shadow-lg shadow-purple-900/40 border border-purple-500/50'
                : currency === 'CNY'
                ? 'bg-gradient-to-br from-red-600 via-red-700 to-red-600 text-white shadow-lg shadow-red-900/40 border border-red-500/50'
                : 'bg-gradient-to-br from-blue-600 via-blue-700 to-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-500/50'
            }`}>
              {currency === 'USD' ? (
                <>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
                  </svg>
                  <span>$</span>
                </>
              ) : (
                <>
                  <span className="text-[10px]">{getCurrencySymbol()}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Converted price display - Enhanced Modern card style */}
        {convertedPrice !== null && inputValue && !isLoadingRate && exchangeRates && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-primary/15 via-primary/8 to-primary/15 border border-primary/30 backdrop-blur-sm shadow-sm">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/25 border border-primary/40">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div className="flex-1 flex items-center gap-2.5 flex-wrap min-w-0">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                {currency === 'UZS' ? 'USD' : 'UZS'}:
              </span>
              <span className="text-sm font-extrabold text-primary whitespace-nowrap">
                {formatConvertedPrice(convertedPrice)}
              </span>
              {exchangeRates && currency !== 'UZS' && (
                <span className="text-[10px] text-muted-foreground/70 ml-auto whitespace-nowrap hidden sm:inline">
                  (1 {currency} = {(currency === 'USD' ? exchangeRates.usd : currency === 'RUB' ? exchangeRates.rub : exchangeRates.cny).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UZS)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Loading indicator - Enhanced style */}
        {isLoadingRate && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-muted/60 border border-border">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-muted-foreground">Kurs yuklanmoqda...</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to get price and currency from CurrencyPriceInput
 * Returns: { price: number, currency: 'USD' | 'UZS' }
 */
export function useCurrencyPrice(value: string, currency: Currency) {
  const cleaned = cleanPrice(value);
  const price = cleaned ? parseFloat(cleaned) : 0;
  
  return {
    price: Number.isFinite(price) ? price : 0,
    currency: currency,
  };
}

