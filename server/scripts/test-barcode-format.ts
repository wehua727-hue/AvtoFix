import { MongoClient } from 'mongodb';

async function testBarcodeFormat() {
  const uri = "mongodb+srv://avtofix2025_db_user:FTnjYsHxkYxgu7qH@cluster0.b2fwuli.mongodb.net/";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('avtofix');
    const collection = db.collection('products');
    
    const userId = '6974aea9af7ded62a69472c4';
    
    console.log('=== BARCODE FORMAT TEST ===');
    
    // 1. Birinchi mahsulotni olish
    const firstProduct = await collection.findOne({ userId: userId });
    
    if (firstProduct) {
      console.log('\n📋 MAHSULOT MA\'LUMOTLARI:');
      console.log(`  ID: ${firstProduct._id}`);
      console.log(`  Nom: ${firstProduct.name}`);
      console.log(`  SKU: ${firstProduct.sku}`);
      
      // 2. Barcode ID yaratish (senik formatida)
      const barcodeId = firstProduct._id.toString().slice(-8).toUpperCase();
      console.log(`  Barcode ID: ${barcodeId}`);
      
      // 3. Qidirish simulatsiyasi
      console.log('\n🔍 QIDIRISH SIMULATSIYASI:');
      
      // Kichik harf bilan
      const lowerCode = barcodeId.toLowerCase();
      console.log(`  Kichik harf: ${lowerCode}`);
      
      // Katta harf bilan
      const upperCode = barcodeId.toUpperCase();
      console.log(`  Katta harf: ${upperCode}`);
      
      // 4. Variant bor mahsulotni topish
      const productWithVariants = await collection.findOne({
        userId: userId,
        'variantSummaries.0': { $exists: true }
      });
      
      if (productWithVariants) {
        console.log('\n📋 VARIANT MAHSULOT:');
        console.log(`  ID: ${productWithVariants._id}`);
        console.log(`  Nom: ${productWithVariants.name}`);
        console.log(`  Variantlar soni: ${productWithVariants.variantSummaries?.length || 0}`);
        
        // Variant barcode ID
        const variantBarcodeId = `${productWithVariants._id.toString().slice(-8).toUpperCase()}V0`;
        console.log(`  Variant Barcode ID: ${variantBarcodeId}`);
        
        // Kichik harf variant
        const lowerVariantCode = variantBarcodeId.toLowerCase();
        console.log(`  Variant kichik harf: ${lowerVariantCode}`);
      }
      
      // 5. Regex test
      console.log('\n🧪 REGEX TEST:');
      
      const testCodes = [
        barcodeId.toLowerCase(),
        barcodeId.toUpperCase(),
        `${barcodeId.toLowerCase()}v0`,
        `${barcodeId.toUpperCase()}V0`
      ];
      
      testCodes.forEach(code => {
        const isVariant = code.match(/^[a-f0-9]+v\d+$/i);
        const isProductId = !isVariant && code.match(/^[a-f0-9]+$/i);
        
        console.log(`  "${code}": ${isVariant ? 'VARIANT' : isProductId ? 'PRODUCT' : 'NOMA\'LUM'}`);
      });
      
    } else {
      console.log('❌ Mahsulot topilmadi');
    }
    
  } catch (error) {
    console.error('Xatolik:', error);
  } finally {
    await client.close();
  }
}

testBarcodeFormat().catch(console.error);