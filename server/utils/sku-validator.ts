import { MongoClient } from 'mongodb';

/**
 * SKU Validator - Har doim unique SKU larni ta'minlaydi
 */

interface SkuValidationResult {
  isValid: boolean;
  error?: string;
  suggestedSku?: string;
}

interface SkuCheckOptions {
  userId: string;
  currentProductId?: string; // Update qilayotganda o'z ID sini exclude qilish uchun
  db: any; // MongoDB database instance
  collection?: string;
}

/**
 * SKU ning unique ekanligini tekshiradi
 */
export async function validateSkuUniqueness(
  sku: string | undefined | null,
  options: SkuCheckOptions
): Promise<SkuValidationResult> {
  
  // SKU bo'sh bo'lsa - OK (ixtiyoriy)
  if (!sku || !sku.trim()) {
    return { isValid: true };
  }

  const { userId, currentProductId, db, collection = 'products' } = options;
  const trimmedSku = sku.trim();
  
  try {
    const productsCollection = db.collection(collection);
    
    // Base filter - faqat shu user ning mahsulotlari
    const baseFilter: any = { userId };
    
    // Agar update qilayotgan bo'lsak, o'z ID sini exclude qilish
    if (currentProductId) {
      baseFilter._id = { $ne: currentProductId };
    }
    
    // 1. Asosiy mahsulotlarda SKU tekshirish
    const existingMainProduct = await productsCollection.findOne({
      ...baseFilter,
      sku: trimmedSku
    });
    
    if (existingMainProduct) {
      return {
        isValid: false,
        error: `SKU "${trimmedSku}" allaqachon ishlatilgan: "${existingMainProduct.name}"`,
        suggestedSku: await generateNextAvailableSku(trimmedSku, options)
      };
    }
    
    // 2. Variant SKU larida tekshirish
    const existingVariantProduct = await productsCollection.findOne({
      ...baseFilter,
      'variantSummaries.sku': trimmedSku
    });
    
    if (existingVariantProduct) {
      const variant = existingVariantProduct.variantSummaries?.find((v: any) => v.sku === trimmedSku);
      return {
        isValid: false,
        error: `SKU "${trimmedSku}" allaqachon ishlatilgan: "${existingVariantProduct.name}" - "${variant?.name || 'Variant'}"`,
        suggestedSku: await generateNextAvailableSku(trimmedSku, options)
      };
    }
    
    return { isValid: true };
    
  } catch (error) {
    console.error('[SKU Validator] Error:', error);
    return {
      isValid: false,
      error: 'SKU tekshirishda xatolik yuz berdi'
    };
  }
}

/**
 * Keyingi mavjud SKU ni generate qiladi
 */
async function generateNextAvailableSku(
  baseSku: string,
  options: SkuCheckOptions
): Promise<string> {
  
  const { userId, db, collection = 'products' } = options;
  
  try {
    const productsCollection = db.collection(collection);
    
    // Raqamli SKU bo'lsa, keyingi raqamni topish
    const skuNum = parseInt(baseSku);
    if (!isNaN(skuNum)) {
      // Eng katta raqamli SKU ni topish
      const maxSkuProduct = await productsCollection
        .find({ userId })
        .toArray();
      
      let maxSku = skuNum;
      
      for (const product of maxSkuProduct) {
        // Asosiy SKU
        if (product.sku) {
          const num = parseInt(product.sku);
          if (!isNaN(num) && num > maxSku) {
            maxSku = num;
          }
        }
        
        // Variant SKU lar
        if (product.variantSummaries) {
          for (const variant of product.variantSummaries) {
            if (variant.sku) {
              const num = parseInt(variant.sku);
              if (!isNaN(num) && num > maxSku) {
                maxSku = num;
              }
            }
          }
        }
      }
      
      return (maxSku + 1).toString();
    }
    
    // Raqamli bo'lmasa, suffix qo'shish
    let counter = 1;
    let suggestedSku = `${baseSku}_${counter}`;
    
    while (true) {
      const validation = await validateSkuUniqueness(suggestedSku, options);
      if (validation.isValid) {
        return suggestedSku;
      }
      counter++;
      suggestedSku = `${baseSku}_${counter}`;
      
      // Infinite loop dan himoya
      if (counter > 1000) {
        return `${baseSku}_${Date.now()}`;
      }
    }
    
  } catch (error) {
    console.error('[SKU Generator] Error:', error);
    return `${baseSku}_${Date.now()}`;
  }
}

/**
 * Variant SKU larini tekshiradi
 */
export async function validateVariantSkus(
  variantSummaries: any[] | undefined,
  options: SkuCheckOptions
): Promise<SkuValidationResult> {
  
  if (!variantSummaries || !Array.isArray(variantSummaries)) {
    return { isValid: true };
  }
  
  // Variant ichida dublikat SKU lar bormi tekshirish
  const skuCounts = new Map<string, number>();
  
  for (const variant of variantSummaries) {
    if (variant.sku && variant.sku.trim()) {
      const sku = variant.sku.trim();
      skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
    }
  }
  
  // Ichki dublikatlar
  for (const [sku, count] of skuCounts) {
    if (count > 1) {
      return {
        isValid: false,
        error: `Variant ichida SKU "${sku}" ${count} marta takrorlangan`
      };
    }
  }
  
  // Har bir variant SKU ni database da tekshirish
  for (const variant of variantSummaries) {
    if (variant.sku && variant.sku.trim()) {
      const validation = await validateSkuUniqueness(variant.sku, options);
      if (!validation.isValid) {
        return {
          isValid: false,
          error: `Variant SKU xatolik: ${validation.error}`,
          suggestedSku: validation.suggestedSku
        };
      }
    }
  }
  
  return { isValid: true };
}

/**
 * Mahsulot yaratish/yangilashdan oldin barcha SKU larni tekshirish
 */
export async function validateProductSkus(
  productData: {
    sku?: string;
    variantSummaries?: any[];
  },
  options: SkuCheckOptions
): Promise<SkuValidationResult> {
  
  // 1. Asosiy SKU tekshirish
  const mainSkuValidation = await validateSkuUniqueness(productData.sku, options);
  if (!mainSkuValidation.isValid) {
    return mainSkuValidation;
  }
  
  // 2. Variant SKU lar tekshirish
  const variantSkuValidation = await validateVariantSkus(productData.variantSummaries, options);
  if (!variantSkuValidation.isValid) {
    return variantSkuValidation;
  }
  
  return { isValid: true };
}