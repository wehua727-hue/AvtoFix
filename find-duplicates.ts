import { MongoClient } from 'mongodb';

async function findDuplicates() {
  const uri = "mongodb+srv://avtofix2025_db_user:FTnjYsHxkYxgu7qH@cluster0.b2fwuli.mongodb.net/";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ MongoDB ga ulandi');
    
    const db = client.db('avtofix');
    const collection = db.collection('products');
    
    // User ID (910712828 telefon raqami)
    const userId = '6974aea9af7ded62a69472c4';
    
    console.log('=== DUPLICATE KODLARNI QIDIRISH ===');
    console.log('User ID:', userId);
    
    // 1. Jami mahsulotlar soni
    const totalProducts = await collection.countDocuments({ userId: userId });
    console.log(`Jami mahsulotlar: ${totalProducts}`);
    
    // 2. Duplicate SKU larni topish
    const duplicates = await collection.aggregate([
      { $match: { userId: userId } },
      { $group: { 
          _id: '$sku', 
          count: { $sum: 1 },
          products: { $push: { id: '$_id', name: '$name', sku: '$sku' } }
        }
      },
      { $match: { count: { $gt: 1 }, _id: { $exists: true, $ne: null, $ne: '' } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    console.log(`\n🚨 DUPLICATE SKU LAR: ${duplicates.length} ta`);
    
    if (duplicates.length > 0) {
      duplicates.forEach((dup: any) => {
        console.log(`\nSKU "${dup._id}": ${dup.count} marta takrorlangan`);
        dup.products.forEach((prod: any, index: number) => {
          console.log(`  ${index + 1}. ID: ${prod.id} - "${prod.name}"`);
        });
      });
    } else {
      console.log('✅ Duplicate SKU topilmadi');
    }
    
    // 3. 1813 kodli mahsulotni qidirish
    console.log('\n=== 1813 KODLI MAHSULOT QIDIRUVI ===');
    
    const product1813 = await collection.findOne({
      userId: userId,
      sku: '1813'
    });
    
    if (product1813) {
      console.log(`✓ SKU 1813 topildi: "${product1813.name}"`);
    } else {
      console.log('❌ SKU 1813 TOPILMADI!');
      
      // Eng katta SKU ni topish
      const allProducts = await collection.find({ userId: userId, sku: { $exists: true, $ne: null, $ne: '' } }).toArray();
      const skus = allProducts.map((p: any) => parseInt(p.sku)).filter(sku => !isNaN(sku)).sort((a, b) => b - a);
      
      console.log(`Eng katta SKU: ${skus[0] || 'topilmadi'}`);
      console.log(`Jami SKU li mahsulotlar: ${skus.length}`);
    }
    
    // 4. SKU siz mahsulotlarni sanash
    const noSkuProducts = await collection.countDocuments({
      userId: userId,
      $or: [
        { sku: { $exists: false } },
        { sku: null },
        { sku: '' }
      ]
    });
    
    console.log(`\nSKU siz mahsulotlar: ${noSkuProducts} ta`);
    
  } catch (error) {
    console.error('Xatolik:', error);
  } finally {
    await client.close();
    console.log('\n✓ Database ulanishi yopildi');
  }
}

findDuplicates().catch(console.error);