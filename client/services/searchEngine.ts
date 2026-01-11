/**
 * ADVANCED SEARCH ENGINE
 * Mahsulot va variantlarni qidirish uchun optimallashtirilgan
 * 
 * Qidiruv imkoniyatlari:
 * - Mahsulot nomi, SKU, barcode
 * - Variant nomi, SKU, barcode
 * - Fuzzy search (xatolar bilan)
 * - Partial match (qisman moslik)
 */

import { OfflineProduct, OfflineVariant, normalizeText, tokenize } from '../db/offlineDB';

// ============================================
// TYPES
// ============================================

export interface SearchResult {
  product: OfflineProduct;
  score: number;
  matchType: 'exact' | 'barcode' | 'sku' | 'fuzzy' | 'partial' | 'variant';
  variant?: OfflineVariant;
  variantIndex?: number;
  // Variant uchun qo'shimcha ma'lumotlar
  isVariant: boolean;
  displayName: string;
  displaySku?: string;
  displayPrice: number;
  displayStock: number;
  parentProductName?: string;
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  categoryId?: string;
  includeVariants?: boolean;
}

// ============================================
// LRU CACHE
// ============================================

class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================
// SEARCH ENGINE CLASS
// ============================================

export class ProductSearchEngine {
  private products: OfflineProduct[] = [];
  private queryCache = new LRUCache<string, SearchResult[]>(100);
  
  // Variant indekslari - tez qidirish uchun
  private variantSkuMap = new Map<string, { product: OfflineProduct; variantIndex: number }>();
  private variantBarcodeMap = new Map<string, { product: OfflineProduct; variantIndex: number }>();
  private variantNameMap = new Map<string, { product: OfflineProduct; variantIndex: number }[]>(); // Variant nomi bo'yicha indeks
  private productSkuMap = new Map<string, OfflineProduct>();
  private productBarcodeMap = new Map<string, OfflineProduct>();
  
  private isIndexed = false;
  private indexedAt = 0;
  private productCount = 0;

  /**
   * Mahsulotlarni indekslash
   */
  async buildIndex(products: OfflineProduct[]): Promise<void> {
    console.time('[SearchEngine] Index build');
    
    this.products = products;
    this.variantSkuMap.clear();
    this.variantBarcodeMap.clear();
    this.variantNameMap.clear();
    this.productSkuMap.clear();
    this.productBarcodeMap.clear();
    this.queryCache.clear();

    let variantCount = 0;

    for (const product of products) {
      // Asosiy mahsulot indekslari
      if (product.sku) {
        const key = product.sku.toLowerCase().trim();
        this.productSkuMap.set(key, product);
        // Raqamli qismi ham indekslansin (masalan: "001" -> "1" ham topilsin)
        const numericPart = key.replace(/^0+/, '');
        if (numericPart && numericPart !== key) {
          this.productSkuMap.set(numericPart, product);
        }
      }
      if (product.barcode) {
        const key = product.barcode.toLowerCase().trim();
        this.productBarcodeMap.set(key, product);
      }
      
      // Variant indekslari
      if (product.variantSummaries && product.variantSummaries.length > 0) {
        for (let i = 0; i < product.variantSummaries.length; i++) {
          const variant = product.variantSummaries[i];
          variantCount++;
          
          // Variant SKU indeksi - MUHIM: barcha variantlarni indekslash
          // SKU raqam yoki string bo'lishi mumkin
          const variantSku = variant.sku !== undefined && variant.sku !== null 
            ? String(variant.sku).toLowerCase().trim() 
            : null;
          
          if (variantSku && variantSku.length > 0) {
            this.variantSkuMap.set(variantSku, { product, variantIndex: i });
            
            // Raqamli qismi ham indekslansin (masalan: "002" -> "2" ham topilsin)
            const numericPart = variantSku.replace(/^0+/, '') || '0';
            if (numericPart !== variantSku) {
              this.variantSkuMap.set(numericPart, { product, variantIndex: i });
            }
            
            // Har xil nol kombinatsiyalari (masalan: "2" -> "02", "002", "0002")
            if (/^\d+$/.test(numericPart)) {
              for (let totalLen = numericPart.length + 1; totalLen <= 6; totalLen++) {
                const paddedKey = numericPart.padStart(totalLen, '0');
                if (!this.variantSkuMap.has(paddedKey)) {
                  this.variantSkuMap.set(paddedKey, { product, variantIndex: i });
                }
              }
            }
          }
          
          // Variant barcode indeksi
          const variantBarcode = variant.barcode !== undefined && variant.barcode !== null
            ? String(variant.barcode).toLowerCase().trim()
            : null;
          
          if (variantBarcode && variantBarcode.length > 0) {
            this.variantBarcodeMap.set(variantBarcode, { product, variantIndex: i });
          }
          
          // MUHIM: Variant nomi bo'yicha indeks - qidiruv uchun
          // Masalan: "Yuxanno" qidirilganda topilishi uchun
          if (variant.name) {
            const variantNameLower = variant.name.toLowerCase().trim();
            const variantNameNormalized = normalizeText(variant.name);
            
            // To'liq nom bo'yicha indeks
            if (!this.variantNameMap.has(variantNameLower)) {
              this.variantNameMap.set(variantNameLower, []);
            }
            this.variantNameMap.get(variantNameLower)!.push({ product, variantIndex: i });
            
            // Normalized nom bo'yicha ham indeks (agar farqli bo'lsa)
            if (variantNameNormalized !== variantNameLower) {
              if (!this.variantNameMap.has(variantNameNormalized)) {
                this.variantNameMap.set(variantNameNormalized, []);
              }
              this.variantNameMap.get(variantNameNormalized)!.push({ product, variantIndex: i });
            }
            
            // Variant nomining har bir so'zini ham indekslash
            const nameTokens = tokenize(variant.name);
            for (const token of nameTokens) {
              if (token.length >= 2) {
                if (!this.variantNameMap.has(token)) {
                  this.variantNameMap.set(token, []);
                }
                // Dublikatlarni oldini olish
                const existing = this.variantNameMap.get(token)!;
                if (!existing.some(e => e.product.id === product.id && e.variantIndex === i)) {
                  existing.push({ product, variantIndex: i });
                }
              }
            }
          }
        }
      }
    }

    this.isIndexed = true;
    this.indexedAt = Date.now();
    this.productCount = products.length;
    
    console.timeEnd('[SearchEngine] Index build');
    // Debug loglar o'chirildi - production uchun
    // console.log(`[SearchEngine] Indexed ${products.length} products, ${variantCount} variants`);
  }

  /**
   * Asosiy qidiruv funksiyasi
   */
  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const { limit = 50, minScore = 15, categoryId, includeVariants = true } = options;
    
    if (!query || query.length < 1) return [];
    if (!this.isIndexed) return [];

    const normalizedQuery = query.trim().toLowerCase();
    
    // Cache tekshirish
    const cacheKey = `${normalizedQuery}:${categoryId || 'all'}:${includeVariants}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached.slice(0, limit);

    let results: SearchResult[] = [];

    // 1. VARIANT SKU/BARCODE QIDIRISH (eng yuqori prioritet)
    if (includeVariants) {
      // Debug log o'chirildi
      
      // To'liq moslik - variant SKU
      const variantBySku = this.variantSkuMap.get(normalizedQuery);
      if (variantBySku) {
        const { product, variantIndex } = variantBySku;
        const variant = product.variantSummaries![variantIndex];
        results.push(this.createVariantResult(product, variant, variantIndex, 100, 'sku'));
        this.queryCache.set(cacheKey, results);
        return results;
      }
      
      // To'liq moslik - variant barcode
      const variantByBarcode = this.variantBarcodeMap.get(normalizedQuery);
      if (variantByBarcode) {
        const { product, variantIndex } = variantByBarcode;
        const variant = product.variantSummaries![variantIndex];
        results.push(this.createVariantResult(product, variant, variantIndex, 100, 'barcode'));
        this.queryCache.set(cacheKey, results);
        return results;
      }
      
      // Raqamli qidiruv (masalan: "2" -> "002", "02", "2")
      if (/^\d+$/.test(normalizedQuery)) {
        const withoutZeros = normalizedQuery.replace(/^0+/, '') || '0';
        
        // Avval asosiy mahsulotni tekshirish (raqamli SKU)
        const productByNumeric = this.productSkuMap.get(withoutZeros);
        if (productByNumeric) {
          results.push(this.createProductResult(productByNumeric, 100, 'sku'));
          this.queryCache.set(cacheKey, results);
          return results;
        }
        
        // Nolsiz variant
        const variantByNumeric = this.variantSkuMap.get(withoutZeros);
        if (variantByNumeric) {
          const { product, variantIndex } = variantByNumeric;
          const variant = product.variantSummaries![variantIndex];
          results.push(this.createVariantResult(product, variant, variantIndex, 100, 'sku'));
          this.queryCache.set(cacheKey, results);
          return results;
        }
        
        // Nol bilan asosiy mahsulot (masalan: "2" -> "02", "002")
        for (let zeros = 1; zeros <= 4; zeros++) {
          const paddedQuery = withoutZeros.padStart(withoutZeros.length + zeros, '0');
          const productByPadded = this.productSkuMap.get(paddedQuery);
          if (productByPadded) {
            results.push(this.createProductResult(productByPadded, 98, 'sku'));
            this.queryCache.set(cacheKey, results);
            return results;
          }
        }
        
        // Nol bilan variant (masalan: "2" -> "02", "002", "0002")
        for (let zeros = 1; zeros <= 4; zeros++) {
          const paddedQuery = withoutZeros.padStart(withoutZeros.length + zeros, '0');
          const variantByPadded = this.variantSkuMap.get(paddedQuery);
          if (variantByPadded) {
            const { product, variantIndex } = variantByPadded;
            const variant = product.variantSummaries![variantIndex];
            results.push(this.createVariantResult(product, variant, variantIndex, 98, 'sku'));
            this.queryCache.set(cacheKey, results);
            return results;
          }
        }
      }
      
      // Qisman moslik - variant SKU oxirida yoki ichida
      const addedVariantKeys = new Set<string>();
      for (const [sku, data] of this.variantSkuMap.entries()) {
        // Faqat qisqa SKU larni tekshirish (uzun nomlarni emas)
        if (sku.length <= 15) {
          const variantKey = `${data.product.id}-v${data.variantIndex}`;
          if (addedVariantKeys.has(variantKey)) continue;
          
          if (sku === normalizedQuery) {
            const { product, variantIndex } = data;
            const variant = product.variantSummaries![variantIndex];
            results.push(this.createVariantResult(product, variant, variantIndex, 100, 'sku'));
            addedVariantKeys.add(variantKey);
          } else if (sku.endsWith(normalizedQuery)) {
            const { product, variantIndex } = data;
            const variant = product.variantSummaries![variantIndex];
            results.push(this.createVariantResult(product, variant, variantIndex, 95, 'sku'));
            addedVariantKeys.add(variantKey);
          } else if (normalizedQuery.length >= 1 && sku.includes(normalizedQuery)) {
            const { product, variantIndex } = data;
            const variant = product.variantSummaries![variantIndex];
            results.push(this.createVariantResult(product, variant, variantIndex, 85, 'sku'));
            addedVariantKeys.add(variantKey);
          }
        }
      }
      
      if (results.length > 0) {
        results.sort((a, b) => b.score - a.score);
        this.queryCache.set(cacheKey, results.slice(0, limit));
        return results.slice(0, limit);
      }
    }

    // 2. VARIANT NOMI BO'YICHA QIDIRISH (indeksdan)
    // Masalan: "Yuxanno" qidirilganda to'g'ridan-to'g'ri topiladi
    if (includeVariants && normalizedQuery.length >= 2) {
      const variantsByName = this.variantNameMap.get(normalizedQuery);
      if (variantsByName && variantsByName.length > 0) {
        const addedKeys = new Set<string>();
        for (const { product, variantIndex } of variantsByName) {
          const variantKey = `${product.id}-v${variantIndex}`;
          if (addedKeys.has(variantKey)) continue;
          addedKeys.add(variantKey);
          
          const variant = product.variantSummaries![variantIndex];
          results.push(this.createVariantResult(product, variant, variantIndex, 98, 'variant'));
        }
        
        if (results.length > 0) {
          results.sort((a, b) => b.score - a.score);
          this.queryCache.set(cacheKey, results.slice(0, limit));
          return results.slice(0, limit);
        }
      }
      
      // Qisman moslik - variant nomi boshlanishi yoki ichida
      const partialNameMatches: SearchResult[] = [];
      const addedPartialKeys = new Set<string>();
      
      for (const [nameKey, variants] of this.variantNameMap.entries()) {
        if (nameKey.startsWith(normalizedQuery) || nameKey.includes(normalizedQuery)) {
          for (const { product, variantIndex } of variants) {
            const variantKey = `${product.id}-v${variantIndex}`;
            if (addedPartialKeys.has(variantKey)) continue;
            addedPartialKeys.add(variantKey);
            
            const variant = product.variantSummaries![variantIndex];
            const score = nameKey.startsWith(normalizedQuery) ? 95 : 85;
            partialNameMatches.push(this.createVariantResult(product, variant, variantIndex, score, 'variant'));
          }
        }
      }
      
      if (partialNameMatches.length > 0) {
        results.push(...partialNameMatches);
      }
    }

    // 3. ASOSIY MAHSULOT SKU/BARCODE QIDIRISH
    const productBySku = this.productSkuMap.get(normalizedQuery);
    if (productBySku) {
      results.push(this.createProductResult(productBySku, 100, 'sku'));
      // Agar faqat mahsulot topilsa va variant topilmagan bo'lsa
      if (results.length === 1) {
        this.queryCache.set(cacheKey, results);
        return results;
      }
    }
    
    const productByBarcode = this.productBarcodeMap.get(normalizedQuery);
    if (productByBarcode && !results.some(r => r.product.id === productByBarcode.id && !r.isVariant)) {
      results.push(this.createProductResult(productByBarcode, 100, 'barcode'));
    }
    
    // Agar variant nomi bo'yicha topilgan bo'lsa, qaytarish
    if (results.length > 0) {
      results.sort((a, b) => b.score - a.score);
      this.queryCache.set(cacheKey, results.slice(0, limit));
      return results.slice(0, limit);
    }

    // 4. TEXT SEARCH - variant va mahsulot nomlarini qidirish
    const queryTokens = tokenize(normalizedQuery);
    const addedProducts = new Set<string>();
    const addedVariants = new Set<string>();

    for (const product of this.products) {
      if (categoryId && product.categoryId !== categoryId) continue;

      // Variant nomlarini qidirish - MUHIM: har bir variant alohida card sifatida chiqadi
      if (includeVariants && product.variantSummaries && product.variantSummaries.length > 0) {
        for (let i = 0; i < product.variantSummaries.length; i++) {
          const variant = product.variantSummaries[i];
          const variantKey = `${product.id}-v${i}`;
          
          if (addedVariants.has(variantKey)) continue;
          
          const variantScore = this.calculateVariantScore(product, variant, normalizedQuery, queryTokens);
          
          if (variantScore >= minScore) {
            results.push(this.createVariantResult(product, variant, i, variantScore, 'variant'));
            addedVariants.add(variantKey);
            // MUHIM: Variant topilganda ham asosiy mahsulotni ko'rsatish mumkin
            // Faqat variant nomi to'liq mos kelganda parent ni qo'shmaslik
            if (variantScore >= 80) {
              addedProducts.add(product.id);
            }
          }
        }
      }

      // Asosiy mahsulot nomini qidirish
      if (!addedProducts.has(product.id)) {
        const productScore = this.calculateProductScore(product, normalizedQuery, queryTokens);
        
        if (productScore >= minScore) {
          results.push(this.createProductResult(product, productScore, productScore === 100 ? 'exact' : 'partial'));
          addedProducts.add(product.id);
          
          // MUHIM: Asosiy mahsulot topilganda uning barcha xillarini ham qo'shish
          if (includeVariants && product.variantSummaries && product.variantSummaries.length > 0) {
            for (let i = 0; i < product.variantSummaries.length; i++) {
              const variant = product.variantSummaries[i];
              const variantKey = `${product.id}-v${i}`;
              
              if (!addedVariants.has(variantKey)) {
                // Xillarni asosiy mahsulotdan past score bilan qo'shish
                results.push(this.createVariantResult(product, variant, i, productScore - 1, 'variant'));
                addedVariants.add(variantKey);
              }
            }
          }
        }
      }
    }

    // Saralash va limitlash
    results.sort((a, b) => b.score - a.score);
    results = results.slice(0, limit);
    
    this.queryCache.set(cacheKey, results);
    return results;
  }

  /**
   * Variant uchun SearchResult yaratish
   * MUHIM: displayStock - OTA MAHSULOT stocki ko'rsatiladi (variant stocki emas)
   * Bu Products sahifasi bilan bir xil ko'rinish beradi
   */
  private createVariantResult(
    product: OfflineProduct,
    variant: OfflineVariant,
    variantIndex: number,
    score: number,
    matchType: SearchResult['matchType']
  ): SearchResult {
    return {
      product,
      score,
      matchType,
      variant,
      variantIndex,
      isVariant: true,
      displayName: variant.name,
      displaySku: variant.sku || product.sku,
      displayPrice: variant.price || product.price,
      displayStock: product.stock ?? 0, // OTA MAHSULOT stocki - Products sahifasi bilan bir xil
      parentProductName: product.name
    };
  }

  /**
   * Mahsulot uchun SearchResult yaratish
   */
  private createProductResult(
    product: OfflineProduct,
    score: number,
    matchType: SearchResult['matchType']
  ): SearchResult {
    return {
      product,
      score,
      matchType,
      isVariant: false,
      displayName: product.name,
      displaySku: product.sku,
      displayPrice: product.price,
      displayStock: product.stock ?? 0
    };
  }

  /**
   * Variant score hisoblash
   * MUHIM: Variant nomi bo'yicha qidirganda yuqori score beradi
   */
  private calculateVariantScore(
    product: OfflineProduct,
    variant: OfflineVariant,
    query: string,
    queryTokens: string[]
  ): number {
    const variantName = normalizeText(variant.name);
    const productName = normalizeText(product.name);
    const fullName = `${productName} ${variantName}`;
    
    // SKU tekshirish (eng yuqori prioritet)
    if (variant.sku) {
      const variantSku = variant.sku.toLowerCase().trim();
      if (variantSku === query) return 100;
      // Raqamli moslik (masalan: "2" -> "002")
      if (/^\d+$/.test(query)) {
        const queryNum = query.replace(/^0+/, '') || '0';
        const skuNum = variantSku.replace(/^0+/, '') || '0';
        if (queryNum === skuNum) return 100;
      }
      if (variantSku.endsWith(query)) return 98;
      if (variantSku.includes(query)) return 95;
    }
    
    // Barcode tekshirish
    if (variant.barcode) {
      const variantBarcode = variant.barcode.toLowerCase().trim();
      if (variantBarcode === query) return 100;
      if (variantBarcode.endsWith(query)) return 98;
      if (variantBarcode.includes(query)) return 95;
    }
    
    // MUHIM: Variant nomi bo'yicha qidirish - yuqori prioritet
    // To'liq nom moslik
    if (variantName === query) return 100;
    if (variantName.startsWith(query)) return 95;
    
    // Variant nomi ichida qidiruv so'zi bor (masalan: "yuxanno" qidirilganda "Yuxanno" topiladi)
    if (variantName.includes(query)) return 90;
    
    // Variant nomi tokenlarida qidiruv (masalan: "yux" qidirilganda "Yuxanno" topiladi)
    const variantNameTokens = tokenize(variant.name);
    for (const vToken of variantNameTokens) {
      if (vToken === query) return 92;
      if (vToken.startsWith(query)) return 88;
      if (vToken.includes(query) && query.length >= 2) return 82;
    }
    
    // Mahsulot + variant nomi
    if (fullName.includes(query)) return 75;
    
    // Token matching
    let score = 0;
    const fullNameTokens = tokenize(fullName);
    let matchedCount = 0;
    
    for (const queryToken of queryTokens) {
      // Avval variant nomida qidirish
      for (const vToken of variantNameTokens) {
        if (vToken === queryToken) {
          score += 25; // Variant nomida to'liq moslik - yuqori ball
          matchedCount++;
          break;
        } else if (vToken.startsWith(queryToken)) {
          score += 20;
          matchedCount++;
          break;
        } else if (vToken.includes(queryToken)) {
          score += 15;
          matchedCount++;
          break;
        } else if (this.fuzzyMatch(queryToken, vToken)) {
          score += 8;
          matchedCount++;
          break;
        }
      }
      
      // Agar variant nomida topilmasa, to'liq nomda qidirish
      if (matchedCount === 0) {
        for (const fToken of fullNameTokens) {
          if (fToken === queryToken) {
            score += 18;
            matchedCount++;
            break;
          } else if (fToken.startsWith(queryToken)) {
            score += 12;
            matchedCount++;
            break;
          } else if (fToken.includes(queryToken)) {
            score += 8;
            matchedCount++;
            break;
          } else if (this.fuzzyMatch(queryToken, fToken)) {
            score += 4;
            matchedCount++;
            break;
          }
        }
      }
    }
    
    if (matchedCount === queryTokens.length && queryTokens.length > 0) {
      score += 15;
    }
    
    return Math.min(score, 99);
  }

  /**
   * Mahsulot score hisoblash
   */
  private calculateProductScore(
    product: OfflineProduct,
    query: string,
    queryTokens: string[]
  ): number {
    const name = product.normalizedName || normalizeText(product.name);
    
    // SKU tekshirish (eng yuqori prioritet)
    if (product.sku) {
      const sku = product.sku.toLowerCase().trim();
      if (sku === query) return 100;
      // Raqamli moslik (masalan: "1" -> "001")
      if (/^\d+$/.test(query)) {
        const queryNum = query.replace(/^0+/, '') || '0';
        const skuNum = sku.replace(/^0+/, '') || '0';
        if (queryNum === skuNum) return 100;
      }
      if (sku.endsWith(query)) return 98;
      if (sku.includes(query)) return 95;
    }
    
    // Barcode tekshirish
    if (product.barcode) {
      const barcode = product.barcode.toLowerCase().trim();
      if (barcode === query) return 100;
      if (barcode.endsWith(query)) return 98;
      if (barcode.includes(query)) return 95;
    }
    
    // Nom tekshirish
    if (name === query) return 100;
    if (name.startsWith(query)) return 90;
    if (name.includes(query)) return 80;
    
    // Token matching
    let score = 0;
    const productKeywords = product.keywords || tokenize(product.name);
    let matchedTokens = 0;

    for (const queryToken of queryTokens) {
      for (const keyword of productKeywords) {
        if (keyword === queryToken) {
          matchedTokens++;
          score += 20;
          break;
        }
        if (keyword.startsWith(queryToken)) {
          matchedTokens++;
          score += 15;
          break;
        }
        if (keyword.includes(queryToken)) {
          matchedTokens++;
          score += 10;
          break;
        }
        if (this.fuzzyMatch(queryToken, keyword)) {
          matchedTokens++;
          score += 5;
          break;
        }
      }
    }

    if (matchedTokens === queryTokens.length && queryTokens.length > 0) {
      score += 15;
    }

    return Math.min(score, 99);
  }

  /**
   * Fuzzy matching
   */
  private fuzzyMatch(query: string, target: string): boolean {
    if (Math.abs(query.length - target.length) > 2) return false;
    const distance = this.levenshteinDistance(query, target);
    const maxDistance = query.length <= 3 ? 1 : 2;
    return distance <= maxDistance;
  }

  /**
   * Levenshtein distance
   */
  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Barcode bo'yicha qidirish
   */
  findByBarcode(barcode: string): OfflineProduct | undefined {
    const key = barcode.toLowerCase().trim();
    // Avval variant barcode
    const variantMatch = this.variantBarcodeMap.get(key);
    if (variantMatch) return variantMatch.product;
    // Keyin mahsulot barcode
    return this.productBarcodeMap.get(key);
  }

  /**
   * SKU bo'yicha qidirish
   */
  findBySku(sku: string): OfflineProduct | undefined {
    const key = sku.toLowerCase().trim();
    // Avval variant SKU
    const variantMatch = this.variantSkuMap.get(key);
    if (variantMatch) return variantMatch.product;
    // Keyin mahsulot SKU
    return this.productSkuMap.get(key);
  }

  /**
   * Variant bilan birga qidirish
   * Kod, SKU, barcode yoki nom bo'yicha qidiradi
   * MUHIM: Faqat TO'LIQ MOSLIK - numpad orqali qidirish uchun
   * Qisman moslik faqat search() funksiyasida ishlaydi
   */
  findByCodeWithVariant(code: string): { product: OfflineProduct; variantIndex?: number } | undefined {
    const key = code.toLowerCase().trim();
    
    // 1. To'liq moslik - Variant SKU (eng yuqori prioritet)
    const variantBySku = this.variantSkuMap.get(key);
    if (variantBySku) {
      return variantBySku;
    }
    
    // 2. To'liq moslik - Variant barcode
    const variantByBarcode = this.variantBarcodeMap.get(key);
    if (variantByBarcode) {
      return variantByBarcode;
    }
    
    // 3. Raqamli qidiruv - FAQAT nol bilan/nolsiz variantlar
    // Masalan: "6" -> "6", "06", "006", "0006"
    // Masalan: "06" -> "6", "06", "006"
    if (/^\d+$/.test(key)) {
      // Nolsiz variant (masalan: "006" -> "6")
      const withoutLeadingZeros = key.replace(/^0+/, '') || '0';
      
      // Agar key va withoutLeadingZeros farqli bo'lsa, nolsiz variantni qidirish
      if (withoutLeadingZeros !== key) {
        const variantByNumeric = this.variantSkuMap.get(withoutLeadingZeros);
        if (variantByNumeric) {
          return variantByNumeric;
        }
      }
      
      // Nol bilan variant (masalan: "6" -> "06", "006", "0006")
      for (let totalLength = withoutLeadingZeros.length + 1; totalLength <= 6; totalLength++) {
        const paddedKey = withoutLeadingZeros.padStart(totalLength, '0');
        if (paddedKey !== key) { // O'zimizni qayta qidirmaslik
          const variantByPadded = this.variantSkuMap.get(paddedKey);
          if (variantByPadded) {
            return variantByPadded;
          }
        }
      }
    }
    
    // 4. Qisqa ID bo'yicha qidirish (etiketkadan scan qilinganda)
    // Etiketkaga productId ning oxirgi 8 ta belgisi chop etiladi
    // Masalan: "9878CA0" yoki "D9878CA0"
    const shortCode = code.toUpperCase();
    if (shortCode.length >= 6 && shortCode.length <= 12) {
      // Variant ID formati: oxirgi 8 ta belgi + "-V" + index
      const variantShortMatch = shortCode.match(/^(.+)-V(\d+)$/);
      if (variantShortMatch) {
        const shortId = variantShortMatch[1];
        const variantIndex = parseInt(variantShortMatch[2], 10);
        // Oxirgi 8 ta belgi bo'yicha mahsulot qidirish
        const product = this.products.find(p => p.id.toUpperCase().endsWith(shortId));
        if (product && product.variantSummaries && product.variantSummaries[variantIndex]) {
          return { product, variantIndex };
        }
      }
      
      // Asosiy mahsulot - oxirgi 8 ta belgi bo'yicha qidirish
      const productByShortId = this.products.find(p => p.id.toUpperCase().endsWith(shortCode));
      if (productByShortId) {
        return { product: productByShortId };
      }
    }
    
    // 5. To'liq mahsulot ID bo'yicha qidirish
    // Variant ID formati: "originalProductId-vIndex"
    const variantIdMatch = code.match(/^(.+)-v(\d+)$/i);
    if (variantIdMatch) {
      const originalProductId = variantIdMatch[1];
      const variantIndex = parseInt(variantIdMatch[2], 10);
      const product = this.products.find(p => p.id === originalProductId);
      if (product && product.variantSummaries && product.variantSummaries[variantIndex]) {
        return { product, variantIndex };
      }
    }
    
    // 6. To'liq asosiy mahsulot ID bo'yicha qidirish
    const productById = this.products.find(p => p.id === code);
    if (productById) {
      return { product: productById };
    }
    
    // 7. Mahsulot SKU - to'liq moslik
    const productBySku = this.productSkuMap.get(key);
    if (productBySku) {
      return { product: productBySku };
    }
    
    // 8. Mahsulot barcode - to'liq moslik
    const productByBarcode = this.productBarcodeMap.get(key);
    if (productByBarcode) {
      return { product: productByBarcode };
    }
    
    // 9. Raqamli qidiruv - mahsulot SKU uchun ham
    if (/^\d+$/.test(key)) {
      const withoutLeadingZeros = key.replace(/^0+/, '') || '0';
      
      if (withoutLeadingZeros !== key) {
        const productByNumeric = this.productSkuMap.get(withoutLeadingZeros);
        if (productByNumeric) {
          return { product: productByNumeric };
        }
      }
      
      for (let totalLength = withoutLeadingZeros.length + 1; totalLength <= 6; totalLength++) {
        const paddedKey = withoutLeadingZeros.padStart(totalLength, '0');
        if (paddedKey !== key) {
          const productByPadded = this.productSkuMap.get(paddedKey);
          if (productByPadded) {
            return { product: productByPadded };
          }
        }
      }
    }
    
    return undefined;
  }

  getStats() {
    return {
      isIndexed: this.isIndexed,
      productCount: this.productCount,
      indexedAt: this.indexedAt,
      variantSkuCount: this.variantSkuMap.size,
      variantBarcodeCount: this.variantBarcodeMap.size
    };
  }

  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Mahsulot barcode indeksini yangilash
   * Yangi barcode generatsiya qilinganda chaqiriladi
   */
  updateProductBarcode(productId: string, barcode: string): void {
    const product = this.products.find(p => p.id === productId);
    if (product) {
      // Eski barcode ni o'chirish (agar mavjud bo'lsa)
      if (product.barcode) {
        this.productBarcodeMap.delete(product.barcode.toLowerCase().trim());
      }
      // Yangi barcode ni qo'shish
      product.barcode = barcode;
      this.productBarcodeMap.set(barcode.toLowerCase().trim(), product);
      this.queryCache.clear();
    }
  }

  /**
   * Variant barcode indeksini yangilash
   * Yangi barcode generatsiya qilinganda chaqiriladi
   */
  updateVariantBarcode(productId: string, variantIndex: number, barcode: string): void {
    const product = this.products.find(p => p.id === productId);
    if (product && product.variantSummaries && product.variantSummaries[variantIndex]) {
      const variant = product.variantSummaries[variantIndex];
      // Eski barcode ni o'chirish (agar mavjud bo'lsa)
      if (variant.barcode) {
        this.variantBarcodeMap.delete(variant.barcode.toLowerCase().trim());
      }
      // Yangi barcode ni qo'shish
      variant.barcode = barcode;
      this.variantBarcodeMap.set(barcode.toLowerCase().trim(), { product, variantIndex });
      this.queryCache.clear();
    }
  }
}

// Singleton instance
export const searchEngine = new ProductSearchEngine();
