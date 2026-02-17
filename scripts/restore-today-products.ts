/**
 * Bugungi kunning ma'lum soatidagi o'chirilgan mahsulotlarni qaytarish
 * 
 * Foydalanish:
 * npx tsx scripts/restore-today-products.ts 17
 * 
 * Bu bugungi kunning soat 17:00 dagi o'chirilgan mahsulotlarni qaytaradi
 */

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'oflayn-dokon';
const PRODUCTS_COLLECTION = 'products';
const PRODUCT_HISTORY_COLLECTION = 'product_history';

// Foydalanuvchi ID (910712828 uchun)
const USER_ID = '697746478dc86ae74f75ad07';

async function main() {
  const hour = parseInt(process.argv[2] || '17');
  
  if (isNaN(hour) || hour < 0 || hour > 23) {
    console.log('❌ Noto\'g\'ri soat. Foydalanish: npx tsx scripts/restore-today-products.ts 17');
    return;
  }

  console.log('========================================');
  console.log(`Bugungi Kunning Soat ${hour}:00 dagi Mahsulotlarni Qaytarish`);
  console.log('========================================\n');

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi\n');

    const db = client.db(DB_NAME);
    const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);
    const productsCollection = db.collection(PRODUCTS_COLLECTION);

    // Bugungi kunning vaqt oralig'ini hisoblash
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const startDate = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:00:00.000Z`);
    const endDate = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:59:59.999Z`);

    console.log(`🔍 Qidirilayotgan vaqt oralig'i:`);
    console.log(`   Boshlanish: ${startDate.toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`);
    console.log(`   Tugash: ${endDate.toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}\n`);

    // O'chirilgan mahsulotlarni topish
    const deletedProducts = await historyCollection.find({
      userId: USER_ID,
      type: 'delete',
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).toArray();

    if (deletedProducts.length === 0) {
      console.log('❌ Bu vaqt oralig\'ida o\'chirilgan mahsulotlar topilmadi');
      return;
    }

    console.log(`✅ ${deletedProducts.length} ta o'chirilgan mahsulot topildi:\n`);

    // Mahsulotlar ro'yxatini ko'rsatish
    deletedProducts.forEach((item: any, index: number) => {
      const deletedAt = new Date(item.createdAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
      console.log(`${index + 1}. ${item.productName} (SKU: ${item.sku || 'N/A'})`);
      console.log(`   O'chirilgan vaqt: ${deletedAt}`);
      console.log(`   Stock: ${item.stock || 0}`);
      console.log(`   Narx: ${item.price || 0} ${item.currency || 'UZS'}`);
      if (item.variants && item.variants.length > 0) {
        console.log(`   Xillar: ${item.variants.length} ta`);
        item.variants.forEach((v: any, vIndex: number) => {
          console.log(`      ${vIndex + 1}. ${v.name} (SKU: ${v.sku || 'N/A'}, Stock: ${v.stock || 0})`);
        });
      }
      console.log('');
    });

    // Mahsulotlarni qaytarish
    console.log('🔄 Mahsulotlar qaytarilmoqda...\n');

    let restoredCount = 0;
    let skippedCount = 0;

    for (const item of deletedProducts) {
      // Dublikat tekshiruvi - SKU bo'yicha
      if (item.sku) {
        const existing = await productsCollection.findOne({ sku: item.sku, userId: USER_ID });
        if (existing) {
          console.log(`⚠️  O'tkazib yuborildi: ${item.productName} (SKU: ${item.sku}) - allaqachon mavjud`);
          skippedCount++;
          continue;
        }
      }

      // Mahsulotni qaytarish
      const productToRestore: any = {
        name: item.productName,
        sku: item.sku || '',
        stock: item.stock || 0,
        initialStock: item.stock || 0,
        price: item.price || 0,
        currency: item.currency || 'UZS',
        basePrice: item.basePrice,
        priceMultiplier: item.priceMultiplier,
        categoryId: item.categoryId,
        description: item.description || '',
        imageUrl: item.imageUrl || '',
        imagePaths: item.imagePaths || [],
        userId: USER_ID,
        status: 'available',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Xillarni qaytarish
      if (item.variants && item.variants.length > 0) {
        productToRestore.variantSummaries = item.variants.map((v: any) => ({
          name: v.name,
          sku: v.sku || '',
          stock: v.stock || 0,
          initialStock: v.stock || 0,
          price: v.price || 0,
          currency: v.currency || productToRestore.currency,
        }));
      }

      await productsCollection.insertOne(productToRestore);
      console.log(`✅ Qaytarildi: ${item.productName} (SKU: ${item.sku || 'N/A'})`);
      restoredCount++;
    }

    console.log('\n========================================');
    console.log(`✅ Jami qaytarildi: ${restoredCount} ta`);
    console.log(`⚠️  O'tkazib yuborildi: ${skippedCount} ta`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

main();
