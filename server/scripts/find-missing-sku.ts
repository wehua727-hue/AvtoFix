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

async function findMissingSku() {
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
    
    // Foydalanuvchining mahsulotlarini olish
    const products = await db.collection<Product>('products').find({ userId: user._id.toString() }).toArray();
    
    console.log(`\n=== MAHSULOTLAR TAHLILI ===`);
    console.log(`Jami mahsulotlar: ${products.length}`);
    
    // Barcha SKU larni to'plash
    const skuMap = new Map<string, Array<{ productId: string, productName: string, type: 'main' | 'variant', variantName?: string }>>();
    const allSkus: string[] = [];
    
    for (const product of products) {
      // Asosiy mahsulot SKU si
      if (product.sku) {
        const sku = product.sku.trim();
        allSkus.push(sku);
        
        if (!skuMap.has(sku)) {
          skuMap.set(sku, []);
        }
        skuMap.get(sku)!.push({
          productId: product._id.toString(),
          productName: product.name,
          type: 'main'
        });
      }
      
      // Variant SKU lari
      if (product.variantSummaries) {
        for (const variant of product.variantSummaries) {
          if (variant.sku) {
            const sku = variant.sku.trim();
            allSkus.push(sku);
            
            if (!skuMap.has(sku)) {
              skuMap.set(sku, []);
            }
            skuMap.get(sku)!.push({
              productId: product._id.toString(),
              productName: product.name,
              type: 'variant',
              variantName: variant.name
            });
          }
        }
      }
    }
    
    console.log(`Jami SKU lar (dublikatlar bilan): ${allSkus.length}`);
    console.log(`Noyob SKU lar: ${skuMap.size}`);
    console.log(`Dublikat SKU lar: ${allSkus.length - skuMap.size}`);
    
    // Dublikat SKU larni topish
    console.log(`\n=== DUBLIKAT SKU LAR ===`);
    let duplicatesFound = 0;
    
    for (const [sku, items] of skuMap.entries()) {
      if (items.length > 1) {
        duplicatesFound++;
        console.log(`\n🔴 DUBLIKAT SKU: "${sku}" (${items.length} marta ishlatilgan)`);
        for (const item of items) {
          if (item.type === 'main') {
            console.log(`  - Mahsulot: ${item.productName} (ID: ${item.productId})`);
          } else {
            console.log(`  - Variant: ${item.variantName} in ${item.productName} (ID: ${item.productId})`);
          }
        }
      }
    }
    
    console.log(`\nJami dublikat SKU lar: ${duplicatesFound}`);
    
    // 1 dan 589 gacha bo'lgan SKU larni tekshirish
    console.log(`\n=== 1 DAN 589 GACHA SKU LAR TEKSHIRISH ===`);
    const missingSkus: number[] = [];
    const duplicateSkus: number[] = [];
    
    for (let i = 1; i <= 589; i++) {
      const skuStr = i.toString();
      if (!skuMap.has(skuStr)) {
        missingSkus.push(i);
      } else if (skuMap.get(skuStr)!.length > 1) {
        duplicateSkus.push(i);
      }
    }
    
    console.log(`Yo'qolgan SKU lar (${missingSkus.length} ta):`);
    if (missingSkus.length <= 20) {
      console.log(`  ${missingSkus.join(', ')}`);
    } else {
      console.log(`  ${missingSkus.slice(0, 20).join(', ')} ... va yana ${missingSkus.length - 20} ta`);
    }
    
    console.log(`\nDublikat SKU lar (${duplicateSkus.length} ta):`);
    if (duplicateSkus.length <= 20) {
      console.log(`  ${duplicateSkus.join(', ')}`);
    } else {
      console.log(`  ${duplicateSkus.slice(0, 20).join(', ')} ... va yana ${duplicateSkus.length - 20} ta`);
    }
    
    // Eng katta SKU ni topish
    let maxSku = 0;
    for (const [sku] of skuMap) {
      const skuNum = parseInt(sku);
      if (!isNaN(skuNum) && skuNum > maxSku) {
        maxSku = skuNum;
      }
    }
    
    console.log(`\n=== STATISTIKA ===`);
    console.log(`Eng katta SKU: ${maxSku}`);
    console.log(`Jami mahsulotlar: ${products.length}`);
    console.log(`Jami SKU lar (dublikatlar bilan): ${allSkus.length}`);
    console.log(`Noyob SKU lar: ${skuMap.size}`);
    console.log(`Yo'qolgan SKU lar: ${missingSkus.length}`);
    console.log(`Dublikat SKU lar: ${duplicateSkus.length}`);
    
    // Agar yo'qolgan SKU lar bo'lsa, ularni yaratish taklifi
    if (missingSkus.length > 0) {
      console.log(`\n=== YO'QOLGAN SKU LARNI YARATISH ===`);
      console.log(`${missingSkus.length} ta yo'qolgan SKU topildi.`);
      console.log(`Bu SKU lar yaratilishi kerak: ${missingSkus.slice(0, 10).join(', ')}${missingSkus.length > 10 ? '...' : ''}`);
      
      // Birinchi yo'qolgan SKU ni yaratish
      if (missingSkus.length > 0) {
        const firstMissingSku = missingSkus[0];
        console.log(`\nBirinchi yo'qolgan SKU ${firstMissingSku} ni yaratamizmi?`);
        
        // Test uchun birinchi yo'qolgan SKU ni yaratish
        const newProduct = {
          userId: user._id.toString(),
          name: `Mahsulot ${firstMissingSku}`,
          sku: firstMissingSku.toString(),
          code: firstMissingSku.toString(),
          catalogNumber: firstMissingSku.toString(),
          sizes: [],
          images: [],
          price: 100000,
          basePrice: 100000,
          priceMultiplier: 1,
          currency: 'UZS',
          categoryId: '',
          stock: 1,
          initialStock: 1,
          status: 'available',
          description: `Bu yo'qolgan SKU ${firstMissingSku} uchun yaratilgan mahsulot`,
          imageUrl: '',
          variantSummaries: [],
          childProducts: [],
          isHidden: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const result = await db.collection('products').insertOne(newProduct);
        
        if (result.insertedId) {
          console.log(`✅ SKU ${firstMissingSku} yaratildi!`);
          console.log(`   ID: ${result.insertedId}`);
          console.log(`   Nomi: ${newProduct.name}`);
        } else {
          console.log(`❌ SKU ${firstMissingSku} yaratishda xatolik!`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

findMissingSku();