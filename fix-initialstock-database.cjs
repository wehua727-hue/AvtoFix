/**
 * Database da initialStock qiymatlarini tuzatish
 * Barcha mahsulotlarga initialStock = stock qo'yish
 */

const { MongoClient } = require('mongodb');

async function fixInitialStock() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('avtofix');
    const collection = db.collection('products');
    
    console.log('🔧 InitialStock qiymatlarini tuzatish...');
    
    // InitialStock yo'q yoki 0 bo'lgan mahsulotlarni topish
    const productsToFix = await collection.find({
      $or: [
        { initialStock: { $exists: false } },
        { initialStock: null },
        { initialStock: { $lte: 0 } }
      ]
    }).toArray();
    
    console.log(`📦 Tuzatish kerak bo'lgan mahsulotlar: ${productsToFix.length}`);
    
    let fixedCount = 0;
    
    for (const product of productsToFix) {
      const currentStock = product.stock || 0;
      
      // InitialStock ni stock bilan bir xil qilish
      await collection.updateOne(
        { _id: product._id },
        { 
          $set: { 
            initialStock: currentStock 
          } 
        }
      );
      
      console.log(`✅ Fixed: SKU "${product.sku}" | Stock: ${currentStock} | InitialStock: ${currentStock}`);
      fixedCount++;
      
      // Xillar uchun ham tuzatish
      if (product.variantSummaries && Array.isArray(product.variantSummaries)) {
        const updatedVariants = product.variantSummaries.map(variant => ({
          ...variant,
          initialStock: variant.stock || 0
        }));
        
        await collection.updateOne(
          { _id: product._id },
          { 
            $set: { 
              variantSummaries: updatedVariants
            } 
          }
        );
        
        console.log(`   ✅ Fixed ${product.variantSummaries.length} variants`);
      }
    }
    
    console.log(`🎉 Jami ${fixedCount} ta mahsulot tuzatildi!`);
    
    // Tekshirish
    const stillBroken = await collection.countDocuments({
      $or: [
        { initialStock: { $exists: false } },
        { initialStock: null }
      ]
    });
    
    console.log(`❌ Hali ham tuzatilmagan: ${stillBroken}`);
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

fixInitialStock().catch(console.error);