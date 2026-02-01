import { MongoClient } from 'mongodb';

async function fixSkuSequence() {
  const uri = "mongodb+srv://avtofix2025_db_user:FTnjYsHxkYxgu7qH@cluster0.b2fwuli.mongodb.net/";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ MongoDB ga ulandi');
    
    const db = client.db('avtofix');
    const collection = db.collection('products');
    
    // User ID (910712828 telefon raqami)
    const userId = '6974aea9af7ded62a69472c4';
    
    console.log('=== SKU KETMA-KETLIGINI TUZATISH ===');
    
    // 1. Barcha mahsulotlarni olish
    const allProducts = await collection.find({ userId }).toArray();
    console.log(`Jami mahsulotlar: ${allProducts.length}`);
    
    // 2. Barcha ishlatilgan SKU larni yig'ish
    const usedSkus = new Set<string>();
    const skuToProduct = new Map<string, any>();
    
    for (const product of allProducts) {
      // Asosiy SKU
      if (product.sku && product.sku.trim()) {
        const sku = product.sku.trim();
        usedSkus.add(sku);
        skuToProduct.set(sku, { type: 'main', product });
      }
      
      // Variant SKU lar
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        for (let i = 0; i < product.variantSummaries.length; i++) {
          const variant = product.variantSummaries[i];
          if (variant.sku && variant.sku.trim()) {
            const sku = variant.sku.trim();
            usedSkus.add(sku);
            skuToProduct.set(sku, { type: 'variant', product, variantIndex: i });
          }
        }
      }
    }
    
    console.log(`Ishlatilgan SKU lar: ${usedSkus.size}`);
    
    // 3. Raqamli SKU larni topish
    const numericSkus = Array.from(usedSkus)
      .map(sku => parseInt(sku))
      .filter(num => !isNaN(num))
      .sort((a, b) => a - b);
    
    console.log(`Raqamli SKU lar: ${numericSkus.length}`);
    console.log(`Eng kichik SKU: ${numericSkus[0] || 'yo\'q'}`);
    console.log(`Eng katta SKU: ${numericSkus[numericSkus.length - 1] || 'yo\'q'}`);
    
    // 4. Bo'sh joylarni topish (1 dan eng katta SKU gacha)
    const maxSku = numericSkus.length > 0 ? numericSkus[numericSkus.length - 1] : 0;
    const missingSkus = [];
    
    for (let i = 1; i <= maxSku; i++) {
      if (!usedSkus.has(i.toString())) {
        missingSkus.push(i);
      }
    }
    
    console.log(`\nBo'sh SKU lar: ${missingSkus.length} ta`);
    if (missingSkus.length > 0) {
      console.log(`Bo'sh SKU lar: ${missingSkus.slice(0, 10).join(', ')}${missingSkus.length > 10 ? '...' : ''}`);
    }
    
    // 5. SKU siz mahsulotlarni topish
    const productsWithoutSku = [];
    
    for (const product of allProducts) {
      // Asosiy mahsulot SKU siz
      if (!product.sku || !product.sku.trim()) {
        productsWithoutSku.push({ type: 'main', product });
      }
      
      // Variant SKU siz
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        for (let i = 0; i < product.variantSummaries.length; i++) {
          const variant = product.variantSummaries[i];
          if (!variant.sku || !variant.sku.trim()) {
            productsWithoutSku.push({ type: 'variant', product, variantIndex: i });
          }
        }
      }
    }
    
    console.log(`SKU siz mahsulotlar: ${productsWithoutSku.length} ta`);
    
    // 6. Bo'sh SKU larni to'ldirish
    let fixedCount = 0;
    let skuIndex = 0;
    
    // Avval bo'sh joylarni to'ldirish
    for (const item of productsWithoutSku) {
      if (skuIndex >= missingSkus.length) break;
      
      const newSku = missingSkus[skuIndex].toString();
      
      if (item.type === 'main') {
        // Asosiy mahsulot SKU sini yangilash
        await collection.updateOne(
          { _id: item.product._id },
          { $set: { sku: newSku, updatedAt: new Date() } }
        );
        console.log(`✅ Asosiy mahsulot "${item.product.name}" -> SKU: ${newSku}`);
      } else {
        // Variant SKU sini yangilash
        await collection.updateOne(
          { _id: item.product._id },
          { $set: { [`variantSummaries.${item.variantIndex}.sku`]: newSku, updatedAt: new Date() } }
        );
        const variantName = item.product.variantSummaries[item.variantIndex].name;
        console.log(`✅ Variant "${item.product.name}" > "${variantName}" -> SKU: ${newSku}`);
      }
      
      fixedCount++;
      skuIndex++;
    }
    
    // 7. Agar SKU siz mahsulotlar ko'p bo'lsa, ketma-ket SKU berish
    if (skuIndex < productsWithoutSku.length) {
      let nextSku = maxSku + 1;
      
      for (let i = skuIndex; i < productsWithoutSku.length; i++) {
        const item = productsWithoutSku[i];
        const newSku = nextSku.toString();
        
        if (item.type === 'main') {
          await collection.updateOne(
            { _id: item.product._id },
            { $set: { sku: newSku, updatedAt: new Date() } }
          );
          console.log(`✅ Asosiy mahsulot "${item.product.name}" -> SKU: ${newSku}`);
        } else {
          await collection.updateOne(
            { _id: item.product._id },
            { $set: { [`variantSummaries.${item.variantIndex}.sku`]: newSku, updatedAt: new Date() } }
          );
          const variantName = item.product.variantSummaries[item.variantIndex].name;
          console.log(`✅ Variant "${item.product.name}" > "${variantName}" -> SKU: ${newSku}`);
        }
        
        fixedCount++;
        nextSku++;
      }
    }
    
    console.log(`\n✅ ${fixedCount} ta SKU tuzatildi`);
    
    // 8. Yakuniy tekshiruv
    console.log('\n=== YAKUNIY TEKSHIRUV ===');
    
    const finalProducts = await collection.find({ userId }).toArray();
    const finalUsedSkus = new Set<string>();
    
    for (const product of finalProducts) {
      if (product.sku && product.sku.trim()) {
        finalUsedSkus.add(product.sku.trim());
      }
      
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        for (const variant of product.variantSummaries) {
          if (variant.sku && variant.sku.trim()) {
            finalUsedSkus.add(variant.sku.trim());
          }
        }
      }
    }
    
    const finalNumericSkus = Array.from(finalUsedSkus)
      .map(sku => parseInt(sku))
      .filter(num => !isNaN(num))
      .sort((a, b) => a - b);
    
    console.log(`Yakuniy SKU lar: ${finalUsedSkus.size}`);
    console.log(`Raqamli SKU lar: ${finalNumericSkus.length}`);
    console.log(`Ketma-ketlik: 1 dan ${finalNumericSkus[finalNumericSkus.length - 1]} gacha`);
    
    // Bo'sh joylar bormi tekshirish
    const finalMissingSkus = [];
    const finalMaxSku = finalNumericSkus[finalNumericSkus.length - 1] || 0;
    
    for (let i = 1; i <= finalMaxSku; i++) {
      if (!finalUsedSkus.has(i.toString())) {
        finalMissingSkus.push(i);
      }
    }
    
    if (finalMissingSkus.length === 0) {
      console.log('✅ Barcha SKU lar ketma-ket!');
    } else {
      console.log(`❌ Hali ham ${finalMissingSkus.length} ta bo'sh joy bor: ${finalMissingSkus.slice(0, 5).join(', ')}`);
    }
    
  } catch (error) {
    console.error('Xatolik:', error);
  } finally {
    await client.close();
    console.log('\n✓ Database ulanishi yopildi');
  }
}

fixSkuSequence().catch(console.error);