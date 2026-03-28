/**
 * O'chirilgan mahsulotlarni qaytarish scripti
 * 
 * Foydalanish:
 * 1. MongoDB'da product_history collection'dan o'chirilgan mahsulotlarni topish
 * 2. Mahsulotlarni products collection'ga qaytarish
 * 
 * Ishga tushirish:
 * npx tsx scripts/restore-deleted-products.ts
 */

import { MongoClient, ObjectId } from 'mongodb';
import * as readline from 'readline';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGO_DB_NAME || 'oflayn-dokon';

interface DeletedProduct {
  _id: ObjectId;
  userId: string;
  type: 'delete';
  productId: string;
  productName: string;
  sku: string;
  stock: number;
  price: number;
  currency: string;
  timestamp: Date;
  // Agar variantlar bo'lsa
  variants?: Array<{
    name: string;
    sku?: string;
    stock: number;
    price: number;
    currency?: string;
  }>;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function main() {
  console.log('🔄 O\'chirilgan mahsulotlarni qaytarish scripti\n');
  
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi\n');
    
    const db = client.db(DB_NAME);
    const historyCollection = db.collection('product_history');
    const productsCollection = db.collection('products');
    
    // 1. Foydalanuvchi ID ni so'rash
    const userId = await question('Foydalanuvchi ID ni kiriting (yoki Enter - barcha foydalanuvchilar): ');
    console.log('');
    
    // 2. O'chirilgan mahsulotlarni topish
    const filter: any = { type: 'delete' };
    if (userId.trim()) {
      filter.userId = userId.trim();
    }
    
    const deletedProducts = await historyCollection
      .find(filter)
      .sort({ timestamp: -1 })
      .toArray() as any[];
    
    if (deletedProducts.length === 0) {
      console.log('❌ O\'chirilgan mahsulotlar topilmadi');
      rl.close();
      return;
    }
    
    console.log(`📋 Jami ${deletedProducts.length} ta o'chirilgan mahsulot topildi:\n`);
    
    // 3. O'chirilgan mahsulotlar ro'yxatini ko'rsatish
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
    
    // 4. Tasdiqlash
    const confirm = await question('Barcha mahsulotlarni qaytarishni xohlaysizmi? (ha/yo\'q): ');
    
    if (confirm.toLowerCase() !== 'ha' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Bekor qilindi');
      rl.close();
      return;
    }
    
    console.log('\n🔄 Mahsulotlarni qaytarish boshlandi...\n');
    
    // 5. Har bir mahsulotni qaytarish
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
    rl.close();
  }
}

main();
