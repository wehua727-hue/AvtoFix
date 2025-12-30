/**
 * Production sayt uchun API orqali initialStock ni tuzatish
 * Bu script deploy qilingan saytda ishlatish uchun
 */

// Production sayt URL ini qo'ying
const API_BASE_URL = process.env.API_URL || 'https://your-production-site.com';

async function fixProductionInitialStock() {
  try {
    console.log('🔧 Production saytda initialStock ni tuzatish...');
    console.log('🌐 API URL:', API_BASE_URL);
    
    // Barcha mahsulotlarni olish
    const response = await fetch(`${API_BASE_URL}/api/products?limit=50000&_nocache=true`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const products = await response.json();
    console.log(`📦 Jami ${products.length} ta mahsulot topildi`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const product of products) {
      try {
        let needsUpdate = false;
        const updateData = {};
        
        // Asosiy mahsulot uchun initialStock tekshirish
        if (!product.initialStock || product.initialStock <= 0) {
          const currentStock = product.stock || 0;
          updateData.initialStock = currentStock;
          needsUpdate = true;
          console.log(`📝 SKU "${product.sku}": initialStock = ${currentStock}`);
        }
        
        // Agar yangilash kerak bo'lsa
        if (needsUpdate) {
          const updateResponse = await fetch(`${API_BASE_URL}/api/products/${product._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
          });
          
          if (updateResponse.ok) {
            console.log(`✅ SKU "${product.sku}": muvaffaqiyatli yangilandi`);
            fixedCount++;
          } else {
            console.error(`❌ SKU "${product.sku}": yangilashda xatolik - ${updateResponse.status}`);
            errorCount++;
          }
          
          // Server ni ortiqcha yuklamaslik uchun kichik pauza
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          skippedCount++;
        }
        
      } catch (productError) {
        console.error(`❌ SKU "${product.sku}" da xatolik:`, productError);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Tugadi!`);
    console.log(`✅ Tuzatildi: ${fixedCount} ta mahsulot`);
    console.log(`⏭️ O'tkazib yuborildi: ${skippedCount} ta mahsulot`);
    console.log(`❌ Xatoliklar: ${errorCount} ta mahsulot`);
    
    if (errorCount === 0) {
      console.log(`🎉 Barcha mahsulotlar muvaffaqiyatli tuzatildi!`);
    }
    
  } catch (error) {
    console.error('❌ Umumiy xatolik:', error);
  }
}

// Script ni ishga tushirish
if (require.main === module) {
  fixProductionInitialStock().catch(console.error);
}

module.exports = { fixProductionInitialStock };