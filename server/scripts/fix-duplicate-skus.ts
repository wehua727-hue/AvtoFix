import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oflayn-dokon';
const DB_NAME = process.env.DB_NAME || 'avtofix';

// Foydalanuvchi ma'lumotlari
const USER_PHONE = '910712828';

interface User {
  _id: string;
  name: string;
  phone: string;
  password: string;
  role: string;
}

interface Product {
  _id: string;
  name: string;
  userId?: string;
  sku?: string;
  code?: string;
  catalogNumber?: string;
  variantSummaries?: Array<{
    name: string;
    sku?: string;
    code?: string;
    catalogNumber?: string;
  }>;
}

async function fixDuplicateSkus() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('MongoDB ga ulandi');
    console.log('Baza nomi:', DB_NAME);
    
    const db = client.db(DB_NAME);
    
    // Foydalanuvchini topish
    console.log(`\n=== ${USER_PHONE} TELEFON RAQAMLI FOYDALANUVCHINI QIDIRISH ===`);
    
    const phoneVariants = [
      USER_PHONE,
      `+998${USER_PHONE}`,
      `998${USER_PHONE}`,
      `+${USER_PHONE}`,
    ];
    
    let user = null;
    for (const phoneVariant of phoneVariants) {
      user = await db.collection<User>('users').findOne({ phone: phoneVariant });
      if (user) {
        console.log(`✅ Foydalanuvchi topildi: ${phoneVariant} formatida`);
        break;
      }
    }
    
    if (!user) {
      console.log('❌ Foydalanuvchi topilmadi!');
      return;
    }
    
    console.log(`✅ Foydalanuvchi: ${user.name} (ID: ${user._id})`);
    console.log(`   Rol: ${user.role}`);
    
    // Foydalanuvchining mahsulotlarini olish
    const products = await db.collection<Product>('products').find({ userId: user._id.toString() }).toArray();
    
    console.log(`\n=== MAHSULOTLAR TAHLILI ===`);
    console.log(`${user.name} uchun ${products.length} ta mahsulot topildi`);
    
    if (products.length === 0) {
      console.log('❌ Bu foydalanuvchi uchun mahsulotlar topilmadi!');
      return;
    }
    
    // SKU larni to'plash va dublikatlarni aniqlash
    const skuMap = new Map<string, Array<{ productId: string, productName: string, type: 'main' | 'variant', variantName?: string, variantIndex?: number }>>();
    
    for (const product of products) {
      // Asosiy mahsulot SKU si
      const mainSku = product.sku?.trim();
      if (mainSku) {
        if (!skuMap.has(mainSku)) {
          skuMap.set(mainSku, []);
        }
        skuMap.get(mainSku)!.push({
          productId: product._id.toString(),
          productName: product.name,
          type: 'main'
        });
      }
      
      // Code va catalogNumber ham tekshirish
      const mainCode = product.code?.trim();
      if (mainCode) {
        if (!skuMap.has(mainCode)) {
          skuMap.set(mainCode, []);
        }
        skuMap.get(mainCode)!.push({
          productId: product._id.toString(),
          productName: product.name,
          type: 'main'
        });
      }
      
      const mainCatalogNumber = product.catalogNumber?.trim();
      if (mainCatalogNumber) {
        if (!skuMap.has(mainCatalogNumber)) {
          skuMap.set(mainCatalogNumber, []);
        }
        skuMap.get(mainCatalogNumber)!.push({
          productId: product._id.toString(),
          productName: product.name,
          type: 'main'
        });
      }
      
      // Variant SKU lari
      if (product.variantSummaries) {
        for (let i = 0; i < product.variantSummaries.length; i++) {
          const variant = product.variantSummaries[i];
          
          const variantSku = variant.sku?.trim();
          if (variantSku) {
            if (!skuMap.has(variantSku)) {
              skuMap.set(variantSku, []);
            }
            skuMap.get(variantSku)!.push({
              productId: product._id.toString(),
              productName: product.name,
              type: 'variant',
              variantName: variant.name,
              variantIndex: i
            });
          }
          
          const variantCode = variant.code?.trim();
          if (variantCode) {
            if (!skuMap.has(variantCode)) {
              skuMap.set(variantCode, []);
            }
            skuMap.get(variantCode)!.push({
              productId: product._id.toString(),
              productName: product.name,
              type: 'variant',
              variantName: variant.name,
              variantIndex: i
            });
          }
          
          const variantCatalogNumber = variant.catalogNumber?.trim();
          if (variantCatalogNumber) {
            if (!skuMap.has(variantCatalogNumber)) {
              skuMap.set(variantCatalogNumber, []);
            }
            skuMap.get(variantCatalogNumber)!.push({
              productId: product._id.toString(),
              productName: product.name,
              type: 'variant',
              variantName: variant.name,
              variantIndex: i
            });
          }
        }
      }
    }
    
    // Dublikatlarni topish va tuzatish
    console.log('\n=== DUBLIKAT SKU/KODLARNI TUZATISH ===');
    let duplicatesFixed = 0;
    let totalDuplicates = 0;
    
    for (const [sku, items] of skuMap.entries()) {
      if (items.length > 1) {
        totalDuplicates++;
        console.log(`\n🔴 DUBLIKAT: "${sku}" (${items.length} ta mahsulotda)`);
        
        // Birinchi elementni saqlab qolamiz, qolganlarini o'zgartiramiz
        for (let i = 1; i < items.length; i++) {
          const item = items[i];
          const newSku = `${sku}_${i}`;
          
          console.log(`  🔧 Tuzatilmoqda: ${item.type === 'main' ? 'Mahsulot' : 'Variant'}: ${item.productName}`);
          console.log(`     Eski SKU: "${sku}" → Yangi SKU: "${newSku}"`);
          
          try {
            if (item.type === 'main') {
              // Asosiy mahsulot SKU sini yangilash
              await db.collection('products').updateOne(
                { _id: item.productId },
                { $set: { sku: newSku } }
              );
            } else {
              // Variant SKU sini yangilash
              const updateField = `variantSummaries.${item.variantIndex}.sku`;
              await db.collection('products').updateOne(
                { _id: item.productId },
                { $set: { [updateField]: newSku } }
              );
            }
            
            duplicatesFixed++;
            console.log(`     ✅ Muvaffaqiyatli yangilandi`);
            
          } catch (error) {
            console.log(`     ❌ Xatolik: ${error}`);
          }
        }
      }
    }
    
    console.log(`\n=== NATIJALAR ===`);
    console.log(`Jami mahsulotlar: ${products.length}`);
    console.log(`Jami noyob SKU/kodlar: ${skuMap.size}`);
    console.log(`Topilgan dublikatlar: ${totalDuplicates}`);
    console.log(`Tuzatilgan dublikatlar: ${duplicatesFixed}`);
    
    if (duplicatesFixed > 0) {
      console.log(`\n✅ ${duplicatesFixed} ta dublikat SKU muvaffaqiyatli tuzatildi!`);
      console.log(`Endi barcha SKU lar noyob bo'lishi kerak.`);
    } else {
      console.log(`\n❌ Hech qanday dublikat tuzatilmadi.`);
    }
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

fixDuplicateSkus();