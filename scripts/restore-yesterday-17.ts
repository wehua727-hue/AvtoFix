/**
 * Kechagi kunning soat 17:00 dagi o'chirilgan mahsulotlarni qaytarish
 * 
 * Foydalanish:
 * npx tsx scripts/restore-yesterday-17.ts
 * 
 * Bu kechagi kunning soat 17:00-17:59 oralig'idagi o'chirilgan mahsulotlarni qaytaradi
 */

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'avtofix'; // ✅ Database nomi o'zgartirildi
const PRODUCTS_COLLECTION = 'products';
const PRODUCT_HISTORY_COLLECTION = 'product_history';

// Foydalanuvchi ID (910712828 uchun)
const USER_ID = '697746478dc86ae74f75ad07';

async function main() {
  console.log('========================================');
  console.log('Kechagi Kunning Soat 17:00 dagi Mahsulotlarni Qaytarish');
  console.log('========================================\n');

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi\n');

    const db = client.db(DB_NAME);
    const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);
    const productsCollection = db.collection(PRODUCTS_COLLECTION);

    // Kechagi kunning sanasini hisoblash
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1); // Kechagi kun
    const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Soat 17:00-17:59 oralig'i
    const startDate = new Date(`${dateStr}T17:00:00.000Z`);
    const endDate = new Date(`${dateStr}T17:59:59.999Z`);

    console.log(`🔍 Qidirilayotgan vaqt oralig'i:`);
    console.log(`   Sana: ${dateStr} (kecha)`);
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
    }).sort({ createdAt: 1 }).toArray();

    if (deletedProducts.length === 0) {
      console.log('❌ Kechagi kunning soat 17:00 da o\'chirilgan mahsulotlar topilmadi');
      console.log('\n💡 Ehtimol:');
      console.log('   1. O\'chirilgan mahsulotlar history ga saqlanmagan');
      console.log('   2. Vaqt zonasi noto\'g\'ri (UTC vs Asia/Tashkent)');
      console.log('   3. Backend eski kod ishlagan va history yozmagan\n');
      
      // Barcha delete history ni ko'rsatish (debug uchun)
      console.log('🔍 Barcha o\'chirilgan mahsulotlar (oxirgi 10 ta):');
      const allDeleted = await historyCollection.find({
        userId: USER_ID,
        type: 'delete'
      }).sort({ createdAt: -1 }).limit(10).toArray();
      
      if (allDeleted.length === 0) {
        console.log('   ❌ Hech qanday o\'chirilgan mahsulot topilmadi (history bo\'sh)');
      } else {
        allDeleted.forEach((item: any, index: number) => {
          const deletedAt = new Date(item.createdAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
          console.log(`   ${index + 1}. ${item.productName} (SKU: ${item.sku || 'N/A'})`);
          console.log(`      O'chirilgan: ${deletedAt}`);
        });
      }
      
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
