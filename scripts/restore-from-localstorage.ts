/**
 * LocalStorage history'dan mahsulotlarni qaytarish
 * 
 * Foydalanish:
 * 1. CHECK-LOCALSTORAGE.md faylini o'qing
 * 2. Browser console'dan history'ni copy qiling
 * 3. localStorage-history.json faylga paste qiling
 * 4. Bu scriptni ishga tushiring
 */

import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'avtofix';
const PRODUCTS_COLLECTION = 'products';
const USER_ID = '697746478dc86ae74f75ad07';

async function main() {
  console.log('========================================');
  console.log('LocalStorage History\'dan Restore');
  console.log('========================================\n');

  // JSON faylni o'qish
  const jsonPath = path.join(process.cwd(), 'localStorage-history.json');
  
  if (!fs.existsSync(jsonPath)) {
    console.log('❌ localStorage-history.json fayli topilmadi!');
    console.log('\n📝 Qadamlar:');
    console.log('   1. CHECK-LOCALSTORAGE.md faylini o\'qing');
    console.log('   2. Browser console\'dan history\'ni copy qiling');
    console.log('   3. localStorage-history.json faylga paste qiling');
    console.log('   4. Bu scriptni qayta ishga tushiring\n');
    return;
  }

  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const history = JSON.parse(jsonContent);

  console.log(`✅ JSON fayl o'qildi: ${history.length} ta history\n`);

  // Faqat delete type'dagi history'larni olish
  const deletedItems = history.filter((item: any) => item.type === 'delete');
  
  if (deletedItems.length === 0) {
    console.log('❌ O\'chirilgan mahsulotlar topilmadi!');
    console.log('\n💡 JSON faylda faqat "type": "delete" bo\'lgan itemlar bo\'lishi kerak\n');
    return;
  }

  console.log(`🗑️  O'chirilgan mahsulotlar: ${deletedItems.length} ta\n`);

  // Mahsulotlarni ko'rsatish
  deletedItems.forEach((item: any, index: number) => {
    const deletedAt = new Date(item.timestamp).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
    console.log(`${index + 1}. ${item.productName} (SKU: ${item.sku || 'N/A'})`);
    console.log(`   O'chirilgan: ${deletedAt}`);
    console.log(`   Stock: ${item.stock || 0}, Narx: ${item.price || 0} ${item.currency || 'UZS'}`);
    if (item.variants && item.variants.length > 0) {
      console.log(`   Xillar: ${item.variants.length} ta`);
    }
    console.log('');
  });

  // MongoDB'ga ulanish
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi\n');

    const db = client.db(DB_NAME);
    const productsCollection = db.collection(PRODUCTS_COLLECTION);

    console.log('🔄 Mahsulotlar qaytarilmoqda...\n');

    let restoredCount = 0;
    let skippedCount = 0;

    for (const item of deletedItems) {
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
