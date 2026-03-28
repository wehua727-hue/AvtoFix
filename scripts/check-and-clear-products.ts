/**
 * Mahsulotlarni tekshirish va tozalash scripti
 * 
 * Foydalanish:
 * npx tsx scripts/check-and-clear-products.ts [userId] [action]
 * 
 * Actions:
 * - check: Faqat tekshirish (default)
 * - clear: Barcha mahsulotlarni o'chirish
 * - clear-range: Kod oralig'i bo'yicha o'chirish
 * 
 * Misol:
 * npx tsx scripts/check-and-clear-products.ts 697746478dc86ae74f75ad07 check
 * npx tsx scripts/check-and-clear-products.ts 697746478dc86ae74f75ad07 clear
 * npx tsx scripts/check-and-clear-products.ts 697746478dc86ae74f75ad07 clear-range 1 20
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGO_DB_NAME || 'oflayn-dokon';

async function main() {
  const userId = process.argv[2];
  const action = process.argv[3] || 'check';
  const minCode = process.argv[4] ? parseInt(process.argv[4]) : null;
  const maxCode = process.argv[5] ? parseInt(process.argv[5]) : null;
  
  if (!userId) {
    console.log('❌ userId majburiy!');
    console.log('Foydalanish: npx tsx scripts/check-and-clear-products.ts [userId] [action]');
    return;
  }
  
  console.log('🔍 Mahsulotlarni tekshirish va tozalash scripti\n');
  console.log(`👤 User ID: ${userId}`);
  console.log(`🎯 Action: ${action}\n`);
  
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi\n');
    
    const db = client.db(DB_NAME);
    const productsCollection = db.collection('products');
    
    // 1. Mahsulotlarni tekshirish
    const products = await productsCollection.find({ userId }).toArray();
    
    console.log(`📦 Jami mahsulotlar: ${products.length} ta\n`);
    
    if (products.length > 0) {
      console.log('📋 Mahsulotlar ro\'yxati:\n');
      products.forEach((p: any, idx) => {
        console.log(`${idx + 1}. ${p.name} (SKU: ${p.sku}, Code: ${p.code || 'N/A'})`);
        if (p.variantSummaries && p.variantSummaries.length > 0) {
          console.log(`   └─ Xillar: ${p.variantSummaries.length} ta`);
        }
      });
      console.log('');
    }
    
    // 2. Action bo'yicha amal qilish
    if (action === 'clear') {
      console.log('⚠️  BARCHA MAHSULOTLARNI O\'CHIRISH!\n');
      console.log('5 soniya kutilmoqda... (Ctrl+C bosib bekor qilishingiz mumkin)\n');
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const result = await productsCollection.deleteMany({ userId });
      console.log(`✅ ${result.deletedCount} ta mahsulot o'chirildi\n`);
      
      // Tarixga yozish
      const historyCollection = db.collection('product_history');
      await historyCollection.insertOne({
        userId,
        type: 'bulk_delete',
        message: `Script orqali ${result.deletedCount} ta mahsulot o'chirildi`,
        timestamp: new Date(),
        createdAt: new Date(),
      });
      
    } else if (action === 'clear-range' && minCode !== null && maxCode !== null) {
      console.log(`⚠️  KOD ORALIG'I BO'YICHA O'CHIRISH: ${minCode} - ${maxCode}\n`);
      
      // Kod oralig'idagi mahsulotlarni topish
      const productsToDelete = products.filter((p: any) => {
        const productCode = parseInt(p.sku);
        
        // Ota mahsulot kodi oraliqda bo'lsa
        if (!isNaN(productCode) && productCode >= minCode && productCode <= maxCode) {
          return true;
        }
        
        // Xillarning kodini tekshirish
        if (p.variantSummaries && p.variantSummaries.length > 0) {
          const hasVariantInRange = p.variantSummaries.some((v: any) => {
            if (!v.sku) return false;
            const variantCode = parseInt(v.sku);
            return !isNaN(variantCode) && variantCode >= minCode && variantCode <= maxCode;
          });
          
          if (hasVariantInRange) {
            return true;
          }
        }
        
        return false;
      });
      
      console.log(`📋 O'chiriladigan mahsulotlar: ${productsToDelete.length} ta\n`);
      
      if (productsToDelete.length > 0) {
        productsToDelete.forEach((p: any, idx) => {
          console.log(`${idx + 1}. ${p.name} (SKU: ${p.sku})`);
        });
        console.log('');
        
        console.log('5 soniya kutilmoqda... (Ctrl+C bosib bekor qilishingiz mumkin)\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // O'chirish
        const deleteIds = productsToDelete.map((p: any) => p._id);
        const result = await productsCollection.deleteMany({
          _id: { $in: deleteIds }
        });
        
        console.log(`✅ ${result.deletedCount} ta mahsulot o'chirildi\n`);
        
        // Tarixga yozish
        const historyCollection = db.collection('product_history');
        await historyCollection.insertOne({
          userId,
          type: 'bulk_delete_range',
          message: `Script orqali ${minCode}-${maxCode} oralig'ida ${result.deletedCount} ta mahsulot o'chirildi`,
          minCode,
          maxCode,
          timestamp: new Date(),
          createdAt: new Date(),
        });
      } else {
        console.log('❌ O\'chiriladigan mahsulotlar topilmadi\n');
      }
      
    } else if (action === 'check') {
      console.log('✅ Tekshirish tugadi. Hech narsa o\'chirilmadi.\n');
    } else {
      console.log('❌ Noto\'g\'ri action! (check, clear, clear-range)\n');
    }
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

main();
