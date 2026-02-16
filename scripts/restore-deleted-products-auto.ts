/**
 * O'chirilgan mahsulotlarni avtomatik qaytarish scripti (non-interactive)
 * 
 * Foydalanish:
 * npx tsx scripts/restore-deleted-products-auto.ts [userId]
 * 
 * Misol:
 * npx tsx scripts/restore-deleted-products-auto.ts 507f1f77bcf86cd799439011
 * npx tsx scripts/restore-deleted-products-auto.ts  # Barcha foydalanuvchilar
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGO_DB_NAME || 'oflayn-dokon';

async function main() {
  console.log('🔄 O\'chirilgan mahsulotlarni qaytarish scripti\n');
  
  const userId = process.argv[2]; // Command line argument
  
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi\n');
    
    const db = client.db(DB_NAME);
    const historyCollection = db.collection('product_history');
    const productsCollection = db.collection('products');
    
    // O'chirilgan mahsulotlarni topish
    const filter: any = { type: 'delete' };
    if (userId) {
      filter.userId = userId;
      console.log(`🔍 Foydalanuvchi: ${userId}\n`);
    } else {
      console.log('🔍 Barcha foydalanuvchilar\n');
    }
    
    const deletedProducts = await historyCollection
      .find(filter)
      .sort({ timestamp: -1 })
      .toArray() as any[];
    
    if (deletedProducts.length === 0) {
      console.log('❌ O\'chirilgan mahsulotlar topilmadi');
      return;
    }
    
    console.log(`📋 Jami ${deletedProducts.length} ta o'chirilgan mahsulot topildi:\n`);
    
    // O'chirilgan mahsulotlar ro'yxatini ko'rsatish
    deletedProducts.forEach((item, index) => {
      const date = new Date(item.timestamp).toLocaleString('uz-UZ');
      console.log(`${index + 1}. ${item.productName} (Kod: ${item.sku})`);
      console.log(`   Sana: ${date}`);
      console.log(`   Stock: ${item.stock}, Narx: ${item.price} ${item.currency}`);
      if (item.variants && item.variants.length > 0) {
        console.log(`   Variantlar: ${item.variants.length} ta`);
      }
      console.log('');
    });
    
    console.log('🔄 Mahsulotlarni qaytarish boshlandi...\n');
    
    // Har bir mahsulotni qaytarish
    let restoredCount = 0;
    let skippedCount = 0;
    
    for (const item of deletedProducts) {
      try {
        // Mahsulot allaqachon mavjudligini tekshirish (SKU bo'yicha)
        const existing = await productsCollection.findOne({ sku: item.sku });
        
        if (existing) {
          console.log(`⚠️  ${item.productName} (${item.sku}) - allaqachon mavjud, o'tkazib yuborildi`);
          skippedCount++;
          continue;
        }
        
        // Mahsulotni qaytarish
        const restoredProduct: any = {
          name: item.productName,
          sku: item.sku,
          price: item.price || 0,
          currency: item.currency || 'UZS',
          stock: item.stock || 0,
          initialStock: item.stock || 0,
          status: 'available',
          userId: item.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          // Agar variantlar bo'lsa
          variantSummaries: item.variants || [],
        };
        
        const result = await productsCollection.insertOne(restoredProduct);
        
        console.log(`✅ ${item.productName} (${item.sku}) - qaytarildi`);
        restoredCount++;
        
        // Tarixga yozish
        await historyCollection.insertOne({
          userId: item.userId,
          type: 'restore',
          productId: result.insertedId.toString(),
          productName: item.productName,
          sku: item.sku,
          stock: item.stock || 0,
          price: item.price || 0,
          currency: item.currency || 'UZS',
          message: `Mahsulot qaytarildi: ${item.productName}`,
          timestamp: new Date(),
          createdAt: new Date(),
        });
        
      } catch (error) {
        console.error(`❌ ${item.productName} (${item.sku}) - xatolik:`, error);
      }
    }
    
    console.log(`\n✅ Jarayon tugadi!`);
    console.log(`   Qaytarildi: ${restoredCount} ta`);
    console.log(`   O'tkazib yuborildi: ${skippedCount} ta`);
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

main();
