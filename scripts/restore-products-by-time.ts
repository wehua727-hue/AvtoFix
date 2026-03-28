/**
 * Vaqt bo'yicha o'chirilgan mahsulotlarni qaytarish
 * 
 * Foydalanish:
 * npx tsx scripts/restore-products-by-time.ts
 */

import { MongoClient, ObjectId } from 'mongodb';
import * as readline from 'readline';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'avtofix'; // ✅ Database nomi o'zgartirildi
const PRODUCTS_COLLECTION = 'products';
const PRODUCT_HISTORY_COLLECTION = 'product_history';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function main() {
  console.log('========================================');
  console.log('Vaqt Bo\'yicha O\'chirilgan Mahsulotlarni Qaytarish');
  console.log('========================================\n');

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi\n');

    const db = client.db(DB_NAME);
    const historyCollection = db.collection(PRODUCT_HISTORY_COLLECTION);
    const productsCollection = db.collection(PRODUCTS_COLLECTION);

    // 1. Foydalanuvchi ID sini so'rash
    const userId = await question('Foydalanuvchi ID sini kiriting (910712828 uchun: 697746478dc86ae74f75ad07): ');
    if (!userId.trim()) {
      console.log('❌ Foydalanuvchi ID kiritilmadi');
      rl.close();
      return;
    }

    // 2. Sanani so'rash (YYYY-MM-DD formatida)
    const dateStr = await question('Sanani kiriting (YYYY-MM-DD, masalan: 2025-02-16): ');
    if (!dateStr.trim()) {
      console.log('❌ Sana kiritilmadi');
      rl.close();
      return;
    }

    // 3. Soatni so'rash (0-23)
    const hourStr = await question('Soatni kiriting (0-23, masalan: 17): ');
    const hour = parseInt(hourStr);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      console.log('❌ Noto\'g\'ri soat kiritildi');
      rl.close();
      return;
    }

    // 4. Vaqt oralig'ini hisoblash
    const startDate = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:00:00.000Z`);
    const endDate = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:59:59.999Z`);

    console.log(`\n🔍 Qidirilayotgan vaqt oralig'i:`);
    console.log(`   Boshlanish: ${startDate.toISOString()}`);
    console.log(`   Tugash: ${endDate.toISOString()}\n`);

    // 5. O'chirilgan mahsulotlarni topish
    const deletedProducts = await historyCollection.find({
      userId: userId.trim(),
      type: 'delete',
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).toArray();

    if (deletedProducts.length === 0) {
      console.log('❌ Bu vaqt oralig\'ida o\'chirilgan mahsulotlar topilmadi');
      rl.close();
      return;
    }

    console.log(`✅ ${deletedProducts.length} ta o'chirilgan mahsulot topildi:\n`);

    // 6. Mahsulotlar ro'yxatini ko'rsatish
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

    // 7. Tasdiqlash
    const confirm = await question('Bu mahsulotlarni qaytarishni xohlaysizmi? (ha/yo\'q): ');
    if (confirm.toLowerCase() !== 'ha' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Bekor qilindi');
      rl.close();
      return;
    }

    // 8. Mahsulotlarni qaytarish
    console.log('\n🔄 Mahsulotlar qaytarilmoqda...\n');

    let restoredCount = 0;
    let skippedCount = 0;

    for (const item of deletedProducts) {
      // Dublikat tekshiruvi - SKU bo'yicha
      if (item.sku) {
        const existing = await productsCollection.findOne({ sku: item.sku, userId: userId.trim() });
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
        userId: userId.trim(),
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
    rl.close();
  }
}

main();
