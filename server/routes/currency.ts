import { RequestHandler } from "express";

/**
 * Currency Exchange Rate API Route
 * 
 * Fetches today's exchange rates (USD, RUB, CNY to UZS) from CBU (Central Bank of Uzbekistan) API.
 * Falls back to exchangerate.host if CBU API fails.
 * Implements 1-hour caching to reduce API calls.
 */

interface ExchangeRateCache {
  usd: number;
  rub: number;
  cny: number;
  date: string;
  timestamp: number;
}

// In-memory cache for exchange rate
// Cache duration: 1 hour, but MUST refresh if date changes (new day)
let rateCache: ExchangeRateCache | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Get today's date in YYYY-MM-DD format (Tashkent timezone - UTC+5)
 * Markaziy banklar kursni har kuni ertalab yangilaydi, shuning uchun
 * kun o'zgarganda avtomatik yangi kurs olinishi kerak
 */
function getTodayDate(): string {
  // Tashkent timezone (UTC+5) uchun sana
  // Server qayerda ishlayotgan bo'lishidan qat'iy nazar, Tashkent vaqtini olamiz
  const now = new Date();
  
  // Tashkent UTC+5, lekin yozgi vaqt (DST) bo'lishi mumkin
  // Oddiy usul: UTC vaqtga 5 soat qo'shamiz
  const tashkentOffset = 5 * 60 * 60 * 1000; // 5 soat millisekundlarda
  const tashkentTime = new Date(now.getTime() + tashkentOffset);
  
  // UTC formatida sana olamiz (chunki offset qo'shganimizdan keyin UTC formatida ishlaymiz)
  const year = tashkentTime.getUTCFullYear();
  const month = String(tashkentTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tashkentTime.getUTCDate()).padStart(2, '0');
  
  const dateStr = `${year}-${month}-${day}`;
  console.log(`[currency] Current date (Tashkent timezone): ${dateStr}`);
  return dateStr;
}

/**
 * Fetch currency rate from CBU (Central Bank of Uzbekistan) API
 * API URL: https://cbu.uz/oz/arkhiv-kursov-valyut/json/{CURRENCY}/?date=YYYY-MM-DD
 * Supported currencies: USD, RUB, CNY
 */
async function fetchFromCBU(currency: 'USD' | 'RUB' | 'CNY', date: string): Promise<number | null> {
  try {
    const url = `https://cbu.uz/oz/arkhiv-kursov-valyut/json/${currency}/?date=${date}`;
    console.log(`[currency] Fetching ${currency} from CBU: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[currency] CBU API error for ${currency}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // CBU API returns an array with one object
    if (Array.isArray(data) && data.length > 0) {
      const rate = data[0];
      // CBU API format: { "Ccy": "USD", "Rate": "11971.25", "Date": "2025-01-23", ... }
      // Rate maydoni string formatida bo'lishi mumkin
      const rateStr = rate.Rate || rate.rate || '0';
      const rateValue = parseFloat(rateStr);
      
      if (rateValue > 0 && Number.isFinite(rateValue)) {
        console.log(`[currency] CBU rate fetched for ${currency} on ${date}: ${rateValue} UZS`);
        return rateValue;
      } else {
        console.error(`[currency] Invalid rate value from CBU for ${currency}: ${rateStr}`);
      }
    } else {
      console.error(`[currency] CBU API returned empty array or invalid format for ${currency} on ${date}`);
    }
    
    console.error(`[currency] Invalid CBU API response format for ${currency}`);
    return null;
  } catch (error) {
    console.error(`[currency] CBU API fetch error for ${currency}:`, error);
    return null;
  }
}

/**
 * Fetch currency rate from exchangerate.host (fallback)
 * API URL: https://api.exchangerate.host/convert?from={CURRENCY}&to=UZS
 * Supported currencies: USD, RUB, CNY
 */
async function fetchFromExchangeRateHost(currency: 'USD' | 'RUB' | 'CNY'): Promise<number | null> {
  try {
    const url = `https://api.exchangerate.host/convert?from=${currency}&to=UZS`;
    console.log(`[currency] Fetching ${currency} from exchangerate.host: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[currency] exchangerate.host API error for ${currency}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.result) {
      const rateValue = parseFloat(data.result);
      
      if (rateValue > 0 && Number.isFinite(rateValue)) {
        console.log(`[currency] exchangerate.host rate fetched for ${currency}: ${rateValue} UZS`);
        return rateValue;
      }
    }
    
    console.error(`[currency] Invalid exchangerate.host API response format for ${currency}`);
    return null;
  } catch (error) {
    console.error(`[currency] exchangerate.host API fetch error for ${currency}:`, error);
    return null;
  }
}

/**
 * Get all exchange rates (USD, RUB, CNY to UZS)
 * Uses cache if available and not expired, otherwise fetches from APIs
 * 
 * IMPORTANT: Kurs har kuni ertalab Markaziy banklar tomonidan yangilanadi,
 * shuning uchun kun o'zgarganda avtomatik yangi kurs olinadi
 */
async function getExchangeRates(): Promise<{ usd: number; rub: number; cny: number; date: string } | null> {
  const now = Date.now();
  const today = getTodayDate();
  
  // CRITICAL: Agar kun o'zgarsa, cache'ni tozalaymiz va yangi kurs olamiz
  // Markaziy banklar har kuni ertalab yangi kurs e'lon qiladi
  if (rateCache && rateCache.date !== today) {
    console.log(`[currency] Date changed from ${rateCache.date} to ${today}, clearing cache and fetching new rates...`);
    rateCache = null; // Eski kundagi cache'ni tozalaymiz
  }
  
  // Check cache validity (faqat bugungi kun uchun)
  if (rateCache && rateCache.date === today) {
    const cacheAge = now - rateCache.timestamp;
    if (cacheAge < CACHE_DURATION) {
      console.log(`[currency] Using cached rates for ${today} (age: ${Math.round(cacheAge / 1000)}s)`);
      return {
        usd: rateCache.usd,
        rub: rateCache.rub,
        cny: rateCache.cny,
        date: rateCache.date,
      };
    } else {
      console.log(`[currency] Cache expired for ${today} (age: ${Math.round(cacheAge / 1000)}s), fetching fresh rates...`);
    }
  }
  
  // Cache expired, doesn't exist, or date changed - fetch new rates
  console.log(`[currency] Fetching fresh exchange rates for ${today}...`);
  
  // Fetch all currencies in parallel
  const currencies: Array<'USD' | 'RUB' | 'CNY'> = ['USD', 'RUB', 'CNY'];
  const rates: { [key: string]: number } = {};
  
  for (const currency of currencies) {
    // Try CBU API first (Markaziy bank API)
    let rate = await fetchFromCBU(currency, today);
    let source = 'CBU';
    
    // Fallback to exchangerate.host if CBU fails
    if (!rate || rate <= 0) {
      console.log(`[currency] CBU API failed for ${currency}, trying exchangerate.host as fallback...`);
      rate = await fetchFromExchangeRateHost(currency);
      source = 'exchangerate.host';
    }
    
    if (rate && rate > 0) {
      rates[currency.toLowerCase()] = rate;
      console.log(`[currency] Successfully fetched ${currency} from ${source}: ${rate} UZS`);
    } else {
      console.error(`[currency] All APIs failed for ${currency}`);
      // Agar cache mavjud bo'lsa, eski qiymatni ishlatamiz
      if (rateCache && rateCache.date === today) {
        rates[currency.toLowerCase()] = rateCache[currency.toLowerCase() as 'usd' | 'rub' | 'cny'];
        console.log(`[currency] Using cached ${currency} rate as fallback`);
      } else {
        // Agar cache ham bo'lmasa, null qaytaramiz
        return null;
      }
    }
  }
  
  // Ensure we have all rates
  if (!rates.usd || !rates.rub || !rates.cny) {
    console.error('[currency] Failed to fetch all required exchange rates');
    // Agar cache mavjud bo'lsa va bugungi kun uchun bo'lsa, uni qaytaramiz
    if (rateCache && rateCache.date === today) {
      console.log('[currency] Returning stale cache as fallback');
      return {
        usd: rateCache.usd,
        rub: rateCache.rub,
        cny: rateCache.cny,
        date: rateCache.date,
      };
    }
    return null;
  }
  
  // Update cache with new rates for today
  rateCache = {
    usd: rates.usd,
    rub: rates.rub,
    cny: rates.cny,
    date: today,
    timestamp: now,
  };
  
  console.log(`[currency] Successfully fetched and cached all rates for ${today}`);
  
  return {
    usd: rates.usd,
    rub: rates.rub,
    cny: rates.cny,
    date: today,
  };
}

/**
 * GET /api/currency/rates
 * Returns today's exchange rates (USD, RUB, CNY to UZS)
 * 
 * Response:
 * {
 *   "success": true,
 *   "rates": {
 *     "usd": 12750.50,
 *     "rub": 135.25,
 *     "cny": 1755.80
 *   },
 *   "date": "2025-11-25"
 * }
 */
export const handleCurrencyRates: RequestHandler = async (req, res) => {
  try {
    const rateData = await getExchangeRates();
    
    if (!rateData) {
      return res.status(503).json({
        success: false,
        message: 'Exchange rate API is temporarily unavailable. Please try again later.',
      });
    }
    
    return res.json({
      success: true,
      rates: {
        usd: rateData.usd,
        rub: rateData.rub,
        cny: rateData.cny,
      },
      date: rateData.date,
    });
  } catch (error) {
    console.error('[currency] Error in handleCurrencyRates:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching exchange rates',
    });
  }
};

/**
 * GET /api/currency/usd
 * Returns today's USD to UZS exchange rate (backward compatibility)
 * 
 * Response:
 * {
 *   "success": true,
 *   "usd": 12750.50,
 *   "date": "2025-11-25"
 * }
 */
export const handleCurrencyUsd: RequestHandler = async (_req, res) => {
  try {
    const rateData = await getExchangeRates();
    
    if (!rateData) {
      return res.status(503).json({
        success: false,
        message: 'Exchange rate API is temporarily unavailable. Please try again later.',
      });
    }
    
    return res.json({
      success: true,
      usd: rateData.usd,
      date: rateData.date,
    });
  } catch (error) {
    console.error('[currency] Error in handleCurrencyUsd:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching exchange rate',
    });
  }
};

/**
 * GET /api/currency/rub
 * Returns today's RUB to UZS exchange rate
 * 
 * Response:
 * {
 *   "success": true,
 *   "rub": 135.25,
 *   "date": "2025-11-25"
 * }
 */
export const handleCurrencyRub: RequestHandler = async (_req, res) => {
  try {
    const rateData = await getExchangeRates();
    
    if (!rateData) {
      return res.status(503).json({
        success: false,
        message: 'Exchange rate API is temporarily unavailable. Please try again later.',
      });
    }
    
    return res.json({
      success: true,
      rub: rateData.rub,
      date: rateData.date,
    });
  } catch (error) {
    console.error('[currency] Error in handleCurrencyRub:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching exchange rate',
    });
  }
};

/**
 * GET /api/currency/cny
 * Returns today's CNY (Chinese Yuan) to UZS exchange rate
 * 
 * Response:
 * {
 *   "success": true,
 *   "cny": 1755.80,
 *   "date": "2025-11-25"
 * }
 */
export const handleCurrencyCny: RequestHandler = async (_req, res) => {
  try {
    const rateData = await getExchangeRates();
    
    if (!rateData) {
      return res.status(503).json({
        success: false,
        message: 'Exchange rate API is temporarily unavailable. Please try again later.',
      });
    }
    
    return res.json({
      success: true,
      cny: rateData.cny,
      date: rateData.date,
    });
  } catch (error) {
    console.error('[currency] Error in handleCurrencyCny:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching exchange rate',
    });
  }
};

