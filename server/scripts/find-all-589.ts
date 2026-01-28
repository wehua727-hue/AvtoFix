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

async function findAll589() {
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
    
    // 1. Barcha collection larni ko'rish
    console.log(`\n=== BARCHA COLLECTION LAR ===`);
    const collections = await db.listCollections().toArray();
    console.log('Mavjud collection lar:');
    for (const collection of collections) {
      console.log(`  - ${collection.name}`);
    }
    
    // 2. Har bir collection da mahsulotlar sonini tekshirish
    console.log(`\n=== HAR BIR COLLECTION DA MAHSULOTLAR SONI ===`);
    for (const collection of collections) {
      if (collection.name.includes('product') || collection.name === 'products') {
        const count = await db.collection(collection.name).countDocuments({ userId: user._id.toString() });
        const totalCount = await db.collection(collection.name).countDocuments();
        console.log(`  ${collection.name}: ${count} ta (sizning), ${totalCount} ta (jami)`);
        
        // Agar bu collection da mahsulotlar bo'lsa, 589 ni qidiramiz
        if (count > 0) {
          const search589 = await db.collection(collection.name).find({
            userId: user._id.toString(),
            $or: [
              { sku: '589' },
              { code: '589' },
              { catalogNumber: '589' },
              { 'variantSummaries.sku': '589' },
              { 'variantSummaries.code': '589' },
              { 'variantSummaries.catalogNumber': '589' }
            ]
          }).toArray();
          
          if (search589.length > 0) {
            console.log(`    ✅ ${collection.name} da "589" topildi: ${search589.length} ta`);
            for (const product of search589) {
              console.log(`      - ${product.name} (SKU: ${product.sku || 'yo\'q'}, Code: ${product.code || 'yo\'q'})`);
            }
          } else {
            console.log(`    ❌ ${collection.name} da "589" topilmadi`);
          }
        }
      }
    }
    
    // 3. Offline products collection ni alohida tekshirish
    const offlineCollectionName = process.env.OFFLINE_PRODUCTS_COLLECTION || 'offline_products';
    console.log(`\n=== OFFLINE PRODUCTS COLLECTION (${offlineCollectionName}) ===`);
    
    try {
      const offlineCount = await db.collection(offlineCollectionName).countDocuments({ userId: user._id.toString() });
      const offlineTotalCount = await db.collection(offlineCollectionName).countDocuments();
      console.log(`${offlineCollectionName}: ${offlineCount} ta (sizning), ${offlineTotalCount} ta (jami)`);
      
      if (offlineCount > 0) {
        const offlineSearch589 = await db.collection(offlineCollectionName).find({
          userId: user._id.toString(),
          $or: [
            { sku: '589' },
            { code: '589' },
            { catalogNumber: '589' },
            { 'variantSummaries.sku': '589' },
            { 'variantSummaries.code': '589' },
            { 'variantSummaries.catalogNumber': '589' }
          ]
        }).toArray();
        
        if (offlineSearch589.length > 0) {
          console.log(`✅ ${offlineCollectionName} da "589" topildi: ${offlineSearch589.length} ta`);
          for (const product of offlineSearch589) {
            console.log(`  - ${product.name} (SKU: ${product.sku || 'yo\'q'}, Code: ${product.code || 'yo\'q'})`);
          }
        } else {
          console.log(`❌ ${offlineCollectionName} da "589" topilmadi`);
        }
      }
    } catch (error) {
      console.log(`❌ ${offlineCollectionName} collection mavjud emas yoki xatolik: ${error}`);
    }
    
    // 4. Barcha foydalanuvchilar bo'yicha 589 ni qidirish
    console.log(`\n=== BARCHA FOYDALANUVCHILAR BO'YICHA "589" QIDIRISH ===`);
    const allUsers589 = await db.collection('products').find({
      $or: [
        { sku: '589' },
        { code: '589' },
        { catalogNumber: '589' },
        { 'variantSummaries.sku': '589' },
        { 'variantSummaries.code': '589' },
        { 'variantSummaries.catalogNumber': '589' }
      ]
    }).toArray();
    
    console.log(`Barcha foydalanuvchilar bo'yicha "589": ${allUsers589.length} ta mahsulot`);
    for (const product of allUsers589) {
      const productUser = await db.collection('users').findOne({ _id: product.userId });
      console.log(`  - ${product.name} (User: ${productUser?.name || 'Noma\'lum'}, Phone: ${productUser?.phone || 'Noma\'lum'})`);
      console.log(`    SKU: ${product.sku || 'yo\'q'}, Code: ${product.code || 'yo\'q'}, Catalog: ${product.catalogNumber || 'yo\'q'}`);
      
      if (product.variantSummaries) {
        for (const variant of product.variantSummaries) {
          if (variant.sku === '589' || variant.code === '589' || variant.catalogNumber === '589') {
            console.log(`    * Variant: ${variant.name} (SKU: ${variant.sku || 'yo\'q'}, Code: ${variant.code || 'yo\'q'})`);
          }
        }
      }
    }
    
    // 5. Sizning profilingizda jami nechta mahsulot bor (barcha collection lar)
    console.log(`\n=== SIZNING PROFILINGIZDA JAMI MAHSULOTLAR ===`);
    let totalProducts = 0;
    
    for (const collection of collections) {
      if (collection.name.includes('product') || collection.name === 'products') {
        const count = await db.collection(collection.name).countDocuments({ userId: user._id.toString() });
        totalProducts += count;
        console.log(`  ${collection.name}: ${count} ta`);
      }
    }
    
    console.log(`\n🔢 JAMI: ${totalProducts} ta mahsulot`);
    
    if (totalProducts === 589) {
      console.log(`✅ Ha! Sizda haqiqatan ham 589 ta mahsulot bor!`);
      console.log(`Demak, 589 kodli mahsulot ham bo'lishi kerak...`);
    } else {
      console.log(`❌ Sizda ${totalProducts} ta mahsulot bor, 589 ta emas.`);
    }
    
    // 6. SKU lar bo'yicha statistika
    console.log(`\n=== SKU LAR STATISTIKASI ===`);
    const allProducts = await db.collection('products').find({ userId: user._id.toString() }).toArray();
    
    const skuCounts = new Map<string, number>();
    const duplicateSkus = new Map<string, Array<{ productId: string, productName: string }>>();
    
    for (const product of allProducts) {
      // Asosiy SKU
      if (product.sku) {
        const sku = product.sku.trim();
        skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
        
        if (!duplicateSkus.has(sku)) {
          duplicateSkus.set(sku, []);
        }
        duplicateSkus.get(sku)!.push({
          productId: product._id.toString(),
          productName: product.name
        });
      }
      
      // Variant SKU lar
      if (product.variantSummaries) {
        for (const variant of product.variantSummaries) {
          if (variant.sku) {
            const sku = variant.sku.trim();
            skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
            
            if (!duplicateSkus.has(sku)) {
              duplicateSkus.set(sku, []);
            }
            duplicateSkus.get(sku)!.push({
              productId: product._id.toString(),
              productName: `${variant.name} (${product.name})`
            });
          }
        }
      }
    }
    
    // Eng katta SKU raqamini topish
    let maxSku = 0;
    for (const [sku] of skuCounts) {
      const skuNum = parseInt(sku);
      if (!isNaN(skuNum) && skuNum > maxSku) {
        maxSku = skuNum;
      }
    }
    
    console.log(`Eng katta SKU raqami: ${maxSku}`);
    console.log(`Jami noyob SKU lar: ${skuCounts.size}`);
    
    // 589 atrofidagi SKU larni tekshirish
    console.log(`\n=== 589 ATROFIDAGI SKU LAR ===`);
    const nearSkus = [585, 586, 587, 588, 589, 590, 591, 592, 593, 594, 595];
    for (const skuNum of nearSkus) {
      const skuStr = skuNum.toString();
      if (skuCounts.has(skuStr)) {
        const count = skuCounts.get(skuStr)!;
        const products = duplicateSkus.get(skuStr)!;
        console.log(`  SKU ${skuStr}: ${count} ta (${products.map(p => p.productName).join(', ')})`);
      } else {
        console.log(`  SKU ${skuStr}: ❌ mavjud emas`);
      }
    }
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

findAll589();