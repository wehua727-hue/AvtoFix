/**
 * Server start qilganda avtomatik SKU larni tartibga solish
 */

export async function autoFixAllSkus(db: any) {
  try {
    console.log('[SKU Auto Fix] Starting automatic SKU cleanup...');
    
    const collection = db.collection('products');
    
    // Barcha userlar uchun tuzatish
    const users = await collection.distinct('userId');
    console.log(`[SKU Auto Fix] Found ${users.length} users`);
    
    for (const userId of users) {
      if (!userId) continue;
      
      await fixUserSkus(db, userId);
    }
    
    console.log('[SKU Auto Fix] ✅ All SKUs fixed successfully');
    
  } catch (error) {
    console.error('[SKU Auto Fix] Error:', error);
  }
}

async function fixUserSkus(db: any, userId: string) {
  try {
    const collection = db.collection('products');
    
    // 1. User ning barcha mahsulotlarini olish
    const allProducts = await collection.find({ userId }).toArray();
    if (allProducts.length === 0) return;
    
    console.log(`[SKU Auto Fix] User ${userId}: ${allProducts.length} products`);
    
    // 2. Barcha ishlatilgan SKU larni yig'ish
    const usedSkus = new Set<string>();
    const skuItems: Array<{
      type: 'main' | 'variant';
      productId: string;
      variantIndex?: number;
      currentSku?: string;
      productName: string;
    }> = [];
    
    for (const product of allProducts) {
      // Asosiy mahsulot
      if (product.sku && product.sku.trim()) {
        const sku = product.sku.trim();
        if (usedSkus.has(sku)) {
          // Duplicate topildi
          skuItems.push({
            type: 'main',
            productId: product._id.toString(),
            currentSku: sku,
            productName: product.name
          });
        } else {
          usedSkus.add(sku);
        }
      } else {
        // SKU yo'q
        skuItems.push({
          type: 'main',
          productId: product._id.toString(),
          productName: product.name
        });
      }
      
      // Variantlar
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        for (let i = 0; i < product.variantSummaries.length; i++) {
          const variant = product.variantSummaries[i];
          if (variant.sku && variant.sku.trim()) {
            const sku = variant.sku.trim();
            if (usedSkus.has(sku)) {
              // Duplicate topildi
              skuItems.push({
                type: 'variant',
                productId: product._id.toString(),
                variantIndex: i,
                currentSku: sku,
                productName: `${product.name} > ${variant.name}`
              });
            } else {
              usedSkus.add(sku);
            }
          } else {
            // SKU yo'q
            skuItems.push({
              type: 'variant',
              productId: product._id.toString(),
              variantIndex: i,
              productName: `${product.name} > ${variant.name}`
            });
          }
        }
      }
    }
    
    if (skuItems.length === 0) {
      console.log(`[SKU Auto Fix] User ${userId}: No issues found`);
      return;
    }
    
    console.log(`[SKU Auto Fix] User ${userId}: Fixing ${skuItems.length} SKU issues`);
    
    // 3. Bo'sh SKU larni topish (1 dan boshlab)
    let nextSku = 1;
    
    for (const item of skuItems) {
      // Bo'sh SKU topish
      while (usedSkus.has(nextSku.toString())) {
        nextSku++;
      }
      
      const newSku = nextSku.toString();
      usedSkus.add(newSku);
      
      // Database da yangilash
      if (item.type === 'main') {
        const { ObjectId } = await import('mongodb');
        await collection.updateOne(
          { _id: new ObjectId(item.productId) },
          { $set: { sku: newSku, updatedAt: new Date() } }
        );
      } else {
        const { ObjectId } = await import('mongodb');
        await collection.updateOne(
          { _id: new ObjectId(item.productId) },
          { $set: { [`variantSummaries.${item.variantIndex}.sku`]: newSku, updatedAt: new Date() } }
        );
      }
      
      console.log(`[SKU Auto Fix] Fixed: ${item.productName} -> SKU: ${newSku}`);
      nextSku++;
    }
    
  } catch (error) {
    console.error(`[SKU Auto Fix] Error for user ${userId}:`, error);
  }
}