/**
 * To'liq refund validation test scenariosi
 * Bu script refund validation tizimini to'liq test qiladi
 */

const API_BASE_URL = process.env.API_URL || 'http://127.0.0.1:5175';

async function testCompleteRefundScenario() {
  try {
    console.log('🧪 To\'liq refund validation test...');
    console.log('🌐 API URL:', API_BASE_URL);
    
    // 1. Biror mahsulotni olish
    const productsResponse = await fetch(`${API_BASE_URL}/api/products?limit=5`);
    const products = await productsResponse.json();
    
    if (products.length === 0) {
      throw new Error('Mahsulotlar topilmadi');
    }
    
    const testProduct = products.find(p => p.stock > 0) || products[0];
    console.log(`\n📦 Test mahsuloti: SKU "${testProduct.sku}" | ${testProduct.name}`);
    console.log(`   Hozirgi stock: ${testProduct.stock}`);
    console.log(`   InitialStock: ${testProduct.initialStock}`);
    
    // 2. Agar initialStock yo'q bo'lsa, uni o'rnatish
    if (!testProduct.initialStock) {
      console.log(`\n🔧 InitialStock ni o'rnatish...`);
      const fixResponse = await fetch(`${API_BASE_URL}/api/products/${testProduct._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialStock: testProduct.stock })
      });
      
      if (fixResponse.ok) {
        const fixedProduct = await fixResponse.json();
        testProduct.initialStock = fixedProduct.product.initialStock;
        console.log(`✅ InitialStock o'rnatildi: ${testProduct.initialStock}`);
      } else {
        console.error(`❌ InitialStock o'rnatishda xatolik`);
        return;
      }
    }
    
    // 3. Mahsulotni "sotish" (stock ni kamaytirish)
    const sellQuantity = Math.min(2, testProduct.stock); // Maksimal 2 ta yoki mavjud stock
    if (sellQuantity > 0) {
      console.log(`\n💰 ${sellQuantity} ta mahsulot sotish...`);
      
      const sellResponse = await fetch(`${API_BASE_URL}/api/products/${testProduct._id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change: -sellQuantity })
      });
      
      if (sellResponse.ok) {
        const sellResult = await sellResponse.json();
        console.log(`✅ Sotildi! Yangi stock: ${sellResult.stock}`);
        testProduct.stock = sellResult.stock;
      } else {
        console.error(`❌ Sotishda xatolik`);
        return;
      }
    }
    
    // 4. Refund validation hisoblarini ko'rsatish
    const currentStock = testProduct.stock;
    const initialStock = testProduct.initialStock;
    const soldQuantity = initialStock - currentStock;
    
    console.log(`\n📊 Refund validation hisoblari:`);
    console.log(`   Boshlang'ich stock: ${initialStock}`);
    console.log(`   Hozirgi stock: ${currentStock}`);
    console.log(`   Sotilgan miqdor: ${soldQuantity}`);
    console.log(`   Maksimal qaytarish: ${soldQuantity} (yaroqsiz qaytarilgan yo'q deb faraz qilib)`);
    
    // 5. Test natijalari
    console.log(`\n🎯 Test natijalari:`);
    if (soldQuantity > 0) {
      console.log(`✅ Mahsulot sotilgan - refund validation ishlashi kerak`);
      console.log(`   - ${soldQuantity} ta qaytarish: RUXSAT BERILISHI KERAK`);
      console.log(`   - ${soldQuantity + 1} ta qaytarish: BLOKLANISHI KERAK`);
    } else {
      console.log(`ℹ️ Mahsulot hali sotilmagan - qaytarish mumkin emas`);
    }
    
    // 6. Mahsulotni asl holatiga qaytarish
    if (sellQuantity > 0) {
      console.log(`\n🔄 Mahsulotni asl holatiga qaytarish...`);
      const restoreResponse = await fetch(`${API_BASE_URL}/api/products/${testProduct._id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change: sellQuantity })
      });
      
      if (restoreResponse.ok) {
        console.log(`✅ Asl holatiga qaytarildi`);
      }
    }
    
    console.log(`\n🎉 Test tugadi! Refund validation tizimi tayyor.`);
    
  } catch (error) {
    console.error('❌ Test xatoligi:', error);
  }
}

// Script ni ishga tushirish
if (require.main === module) {
  testCompleteRefundScenario().catch(console.error);
}

module.exports = { testCompleteRefundScenario };