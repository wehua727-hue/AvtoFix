/**
 * Avtomatik SKU generator - Har doim unique SKU yaratadi
 */

interface AutoSkuOptions {
  userId: string;
  db: any;
  collection?: string;
}

/**
 * Keyingi mavjud SKU ni avtomatik generate qiladi
 */
export async function generateNextSku(options: AutoSkuOptions): Promise<string> {
  const { userId, db, collection = 'products' } = options;
  
  try {
    const productsCollection = db.collection(collection);
    
    // Barcha mahsulotlarni olish
    const allProducts = await productsCollection
      .find({ userId })
      .toArray();
    
    // Barcha ishlatilgan SKU larni yig'ish
    const usedSkus = new Set<string>();
    
    for (const product of allProducts) {
      // Asosiy SKU
      if (product.sku && product.sku.trim()) {
        usedSkus.add(product.sku.trim());
      }
      
      // Variant SKU lar
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        for (const variant of product.variantSummaries) {
          if (variant.sku && variant.sku.trim()) {
            usedSkus.add(variant.sku.trim());
          }
        }
      }
    }
    
    // Raqamli SKU larni topish va eng kattasini aniqlash
    const numericSkus = Array.from(usedSkus)
      .map(sku => parseInt(sku))
      .filter(num => !isNaN(num))
      .sort((a, b) => b - a);
    
    // Keyingi SKU
    const nextSku = numericSkus.length > 0 ? numericSkus[0] + 1 : 1;
    
    console.log(`[Auto SKU] Generated next SKU: ${nextSku} (max existing: ${numericSkus[0] || 0})`);
    
    return nextSku.toString();
    
  } catch (error) {
    console.error('[Auto SKU] Error generating SKU:', error);
    // Fallback - timestamp based
    return Date.now().toString();
  }
}

/**
 * Bo'sh SKU larni avtomatik to'ldirish
 */
export async function fillEmptySkus(options: AutoSkuOptions): Promise<number> {
  const { userId, db, collection = 'products' } = options;
  
  try {
    const productsCollection = db.collection(collection);
    
    // SKU siz mahsulotlarni topish
    const productsWithoutSku = await productsCollection
      .find({
        userId,
        $or: [
          { sku: { $exists: false } },
          { sku: null },
          { sku: '' }
        ]
      })
      .toArray();
    
    if (productsWithoutSku.length === 0) {
      console.log('[Auto SKU] No products without SKU found');
      return 0;
    }
    
    console.log(`[Auto SKU] Found ${productsWithoutSku.length} products without SKU`);
    
    let updatedCount = 0;
    
    for (const product of productsWithoutSku) {
      const newSku = await generateNextSku(options);
      
      await productsCollection.updateOne(
        { _id: product._id },
        { 
          $set: { 
            sku: newSku,
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`[Auto SKU] Updated product "${product.name}" with SKU: ${newSku}`);
      updatedCount++;
    }
    
    return updatedCount;
    
  } catch (error) {
    console.error('[Auto SKU] Error filling empty SKUs:', error);
    return 0;
  }
}