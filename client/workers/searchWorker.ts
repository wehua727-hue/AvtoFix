/**
 * SEARCH WEB WORKER
 * Main thread'ni bloklamasdan qidiruv
 * 
 * Bu worker background'da ishlaydi va
 * UI smooth qolishini ta'minlaydi
 */

// Worker context
const ctx: Worker = self as any;

// ============================================
// TYPES
// ============================================

interface Product {
  id: string;
  name: string;
  normalizedName: string;
  keywords: string[];
  sku?: string;
  barcode?: string;
  price: number;
  stock: number;
  categoryId?: string;
}

interface SearchResult {
  product: Product;
  score: number;
  matchType: 'exact' | 'barcode' | 'sku' | 'fuzzy' | 'partial';
}

interface WorkerMessage {
  type: 'INIT' | 'SEARCH' | 'UPDATE';
  payload: any;
  requestId?: string;
}

// ============================================
// STATE
// ============================================

let products: Product[] = [];
let barcodeMap = new Map<string, Product>();
let skuMap = new Map<string, Product>();
let isInitialized = false;

// ============================================
// MESSAGE HANDLER
// ============================================

ctx.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload, requestId } = event.data;

  switch (type) {
    case 'INIT':
      initializeIndex(payload.products);
      ctx.postMessage({ type: 'INIT_COMPLETE', requestId });
      break;

    case 'SEARCH':
      const results = search(payload.query, payload.options);
      ctx.postMessage({ type: 'SEARCH_RESULTS', results, requestId });
      break;

    case 'UPDATE':
      updateProducts(payload.products);
      ctx.postMessage({ type: 'UPDATE_COMPLETE', requestId });
      break;
  }
};

// ============================================
// INDEX FUNCTIONS
// ============================================

function initializeIndex(productList: Product[]): void {
  console.log('[Worker] Initializing index with', productList.length, 'products');
  
  products = productList;
  barcodeMap.clear();
  skuMap.clear();

  for (const product of products) {
    if (product.barcode) {
      barcodeMap.set(product.barcode, product);
    }
    if (product.sku) {
      skuMap.set(product.sku.toLowerCase(), product);
    }
  }

  isInitialized = true;
  console.log('[Worker] Index initialized');
}

function updateProducts(newProducts: Product[]): void {
  for (const product of newProducts) {
    const index = products.findIndex(p => p.id === product.id);
    if (index >= 0) {
      products[index] = product;
    } else {
      products.push(product);
    }

    if (product.barcode) {
      barcodeMap.set(product.barcode, product);
    }
    if (product.sku) {
      skuMap.set(product.sku.toLowerCase(), product);
    }
  }
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

function search(query: string, options: { limit?: number; categoryId?: string } = {}): SearchResult[] {
  if (!isInitialized || !query) return [];

  const { limit = 50, categoryId } = options;
  const normalizedQuery = query.trim().toLowerCase();
  let results: SearchResult[] = [];

  // 1. Barcode lookup (O(1))
  if (/^\d+$/.test(normalizedQuery)) {
    const barcodeMatch = barcodeMap.get(normalizedQuery);
    if (barcodeMatch) {
      return [{ product: barcodeMatch, score: 100, matchType: 'barcode' }];
    }
  }

  // 2. SKU lookup (O(1))
  const skuMatch = skuMap.get(normalizedQuery);
  if (skuMatch) {
    results.push({ product: skuMatch, score: 100, matchType: 'sku' });
  }

  // 3. Text search (O(n))
  const queryTokens = tokenize(normalizedQuery);

  for (const product of products) {
    if (categoryId && product.categoryId !== categoryId) continue;
    if (skuMatch && product.id === skuMatch.id) continue;

    const score = calculateScore(product, normalizedQuery, queryTokens);
    if (score >= 20) {
      results.push({
        product,
        score,
        matchType: score === 100 ? 'exact' : score >= 70 ? 'partial' : 'fuzzy'
      });
    }
  }

  // Sort and limit
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

function calculateScore(product: Product, query: string, queryTokens: string[]): number {
  let score = 0;
  const name = product.normalizedName || product.name.toLowerCase();

  if (name === query) return 100;
  if (name.startsWith(query)) return 90;
  if (name.includes(query)) return 80;

  const productKeywords = product.keywords || tokenize(product.name);
  let matchedTokens = 0;

  for (const queryToken of queryTokens) {
    for (const keyword of productKeywords) {
      if (keyword === queryToken) {
        matchedTokens++;
        score += 15;
        break;
      }
      if (keyword.startsWith(queryToken)) {
        matchedTokens++;
        score += 10;
        break;
      }
      if (fuzzyMatch(queryToken, keyword)) {
        matchedTokens++;
        score += 5;
        break;
      }
    }
  }

  if (matchedTokens === queryTokens.length && queryTokens.length > 0) {
    score += 20;
  }

  return Math.min(score, 99);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 1);
}

function fuzzyMatch(query: string, target: string): boolean {
  if (Math.abs(query.length - target.length) > 2) return false;
  const distance = levenshteinDistance(query, target);
  return distance <= (query.length <= 3 ? 1 : 2);
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

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

console.log('[Worker] Search worker loaded');
