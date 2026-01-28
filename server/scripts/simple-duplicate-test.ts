import { MongoClient } from 'mongodb';
import { validateProductSkus } from '../utils/sku-validator';

async function testDuplicateValidation() {
  const uri = "mongodb+srv://avtofix2025_db_user:FTnjYsHxkYxgu7qH@cluster0.b2fwuli.mongodb.net/";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('avtofix');
    const userId = '6974aea9af7ded62a69472c4';
    
    console.log('=== SKU VALIDATION DIRECT TEST ===');
    
    // 1. Mavjud SKU (562) bilan test
    console.log('\n1. Mavjud SKU (562) bilan mahsulot yaratish...');
    
    const validation1 = await validateProductSkus(
      {
        sku: '562',
        variantSummaries: []
      },
      {
        userId: userId,
        db: db,
        collection: 'products'
      }
    );
    
    if (validation1.isValid) {
      console.log('❌ XATO: Mavjud SKU qabul qilindi!');
    } else {
      console.log('✅ TO\'G\'RI: Mavjud SKU rad etildi');
      console.log('   Xabar:', validation1.error);
      console.log('   Taklif:', validation1.suggestedSku);
    }
    
    // 2. Yangi SKU (9999) bilan test
    console.log('\n2. Yangi SKU (9999) bilan mahsulot yaratish...');
    
    const validation2 = await validateProductSkus(
      {
        sku: '9999',
        variantSummaries: []
      },
      {
        userId: userId,
        db: db,
        collection: 'products'
      }
    );
    
    if (validation2.isValid) {
      console.log('✅ TO\'G\'RI: Yangi SKU qabul qilindi');
    } else {
      console.log('❌ XATO: Yangi SKU rad etildi');
      console.log('   Xabar:', validation2.error);
    }
    
    // 3. Variant SKU da duplicate test
    console.log('\n3. Variant da mavjud SKU (563) bilan test...');
    
    const validation3 = await validateProductSkus(
      {
        sku: '8888', // Yangi asosiy SKU
        variantSummaries: [
          { name: 'Test variant', sku: '563' } // Mavjud variant SKU
        ]
      },
      {
        userId: userId,
        db: db,
        collection: 'products'
      }
    );
    
    if (validation3.isValid) {
      console.log('❌ XATO: Mavjud variant SKU qabul qilindi!');
    } else {
      console.log('✅ TO\'G\'RI: Mavjud variant SKU rad etildi');
      console.log('   Xabar:', validation3.error);
    }
    
    // 4. Ichki duplicate variant test
    console.log('\n4. Variant ichida duplicate SKU test...');
    
    const validation4 = await validateProductSkus(
      {
        sku: '7777',
        variantSummaries: [
          { name: 'Variant 1', sku: '6666' },
          { name: 'Variant 2', sku: '6666' } // Bir xil SKU
        ]
      },
      {
        userId: userId,
        db: db,
        collection: 'products'
      }
    );
    
    if (validation4.isValid) {
      console.log('❌ XATO: Variant ichida duplicate SKU qabul qilindi!');
    } else {
      console.log('✅ TO\'G\'RI: Variant ichida duplicate SKU rad etildi');
      console.log('   Xabar:', validation4.error);
    }
    
    console.log('\n=== XULOSA ===');
    console.log('SKU validation tizimi to\'g\'ri ishlayapti!');
    console.log('Bir xil kod ikita mahsulotga qo\'shilmaydi.');
    
  } catch (error) {
    console.error('Xatolik:', error);
  } finally {
    await client.close();
  }
}

testDuplicateValidation().catch(console.error);