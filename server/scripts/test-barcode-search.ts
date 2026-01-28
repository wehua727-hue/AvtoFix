import { MongoClient } from 'mongodb';

async function testBarcodeSearch() {
  const uri = "mongodb+srv://avtofix2025_db_user:FTnjYsHxkYxgu7qH@cluster0.b2fwuli.mongodb.net/";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('avtofix');
    const collection = db.collection('products');
    
    const userId = '6974aea9af7ded62a69472c4';
    
    console.log('=== BARCODE SEARCH TEST ===');
    
    // 1. Barcha mahsulotlarni olish
    const allProducts = await collection.find({ userId: userId }).toArray();
    console.log(`Jami mahsulotlar: ${allProducts.length}`);
    
    // 2. Barcode/SKU li mahsulotlarni sanash
    let productsWithSku = 0;
    let productsWithBarcode = 0;
    let variantsWithSku = 0;
    let variantsWithBarcode = 0;
    
    const sampleProducts: any[] = [];
    
    allProducts.forEach(product => {
      // Asosiy mahsulot
      if (product.sku) {
        productsWithSku++;
        if (sampleProducts.length < 10) {
          sampleProducts.push({
            type: 'main',
            name: product.name,
            sku: product.sku,
            barcode: product.barcode || 'yo\'q'
          });
        }
      }
      if (product.barcode) productsWithBarcode++;
      
      // Variantlar
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        product.variantSummaries.forEach((variant: any, index: number) => {
          if (variant.sku) {
            variantsWithSku++;
            if (sampleProducts.length < 10) {
              sampleProducts.push({
                type: 'variant',
                name: `${product.name} > ${variant.name || 'Variant ' + (index + 1)}`,
                sku: variant.sku,
                barcode: variant.barcode || 'yo\'q'
              });
            }
          }
          if (variant.barcode) variantsWithBarcode++;
        });
      }
    });
    
    console.log('\n📊 STATISTIKA:');
    console.log(`  Asosiy mahsulotlar SKU bilan: ${productsWithSku}`);
    console.log(`  Asosiy mahsulotlar barcode bilan: ${productsWithBarcode}`);
    console.log(`  Variantlar SKU bilan: ${variantsWithSku}`);
    console.log(`  Variantlar barcode bilan: ${variantsWithBarcode}`);
    
    console.log('\n📋 NAMUNA MAHSULOTLAR:');
    sampleProducts.forEach((item, index) => {
      console.log(`  ${index + 1}. [${item.type.toUpperCase()}] "${item.name}"`);
      console.log(`     SKU: ${item.sku}, Barcode: ${item.barcode}`);
    });
    
    // 3. Konkret SKU larni test qilish
    console.log('\n🔍 KONKRET SKU TEST:');
    const testSkus = ['562', '563', '564', '565', '566', '567'];
    
    for (const testSku of testSkus) {
      // Asosiy mahsulotda qidirish
      const mainProduct = await collection.findOne({
        userId: userId,
        sku: testSku
      });
      
      // Variantda qidirish
      const variantProduct = await collection.findOne({
        userId: userId,
        'variantSummaries.sku': testSku
      });
      
      if (mainProduct) {
        console.log(`  ✅ SKU ${testSku}: ASOSIY - "${mainProduct.name}"`);
      } else if (variantProduct) {
        const variant = variantProduct.variantSummaries?.find((v: any) => v.sku === testSku);
        console.log(`  ✅ SKU ${testSku}: VARIANT - "${variantProduct.name}" > "${variant?.name}"`);
      } else {
        console.log(`  ❌ SKU ${testSku}: TOPILMADI`);
      }
    }
    
    // 4. Barcode qidirish test
    console.log('\n🔍 BARCODE QIDIRISH TEST:');
    
    // Birinchi barcode li mahsulotni topish
    const productWithBarcode = await collection.findOne({
      userId: userId,
      barcode: { $exists: true, $ne: null, $ne: '' }
    });
    
    if (productWithBarcode) {
      console.log(`  Test barcode: "${productWithBarcode.barcode}"`);
      console.log(`  Mahsulot: "${productWithBarcode.name}"`);
      
      // Barcode bilan qidirish
      const foundByBarcode = await collection.findOne({
        userId: userId,
        barcode: productWithBarcode.barcode
      });
      
      if (foundByBarcode) {
        console.log(`  ✅ Barcode bilan topildi: "${foundByBarcode.name}"`);
      } else {
        console.log(`  ❌ Barcode bilan topilmadi`);
      }
    } else {
      console.log('  ⚠️ Barcode li mahsulot topilmadi');
    }
    
    // 5. Variant barcode test
    const variantWithBarcode = await collection.findOne({
      userId: userId,
      'variantSummaries.barcode': { $exists: true, $ne: null, $ne: '' }
    });
    
    if (variantWithBarcode && variantWithBarcode.variantSummaries) {
      const variant = variantWithBarcode.variantSummaries.find((v: any) => v.barcode);
      if (variant) {
        console.log(`  Test variant barcode: "${variant.barcode}"`);
        console.log(`  Variant: "${variantWithBarcode.name}" > "${variant.name}"`);
        
        const foundByVariantBarcode = await collection.findOne({
          userId: userId,
          'variantSummaries.barcode': variant.barcode
        });
        
        if (foundByVariantBarcode) {
          console.log(`  ✅ Variant barcode bilan topildi`);
        } else {
          console.log(`  ❌ Variant barcode bilan topilmadi`);
        }
      }
    }
    
  } catch (error) {
    console.error('Xatolik:', error);
  } finally {
    await client.close();
  }
}

testBarcodeSearch().catch(console.error);