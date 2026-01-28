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

async function testSearch589() {
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
    
    console.log(`\n=== MAHSULOTLAR STATISTIKASI ===`);
    console.log(`Server da: ${products.length} ta mahsulot`);
    
    // 589 ni turli usullar bilan qidirish
    console.log(`\n=== "589" QIDIRISH TESTLARI ===`);
    
    // 1. Aniq SKU qidirish
    const exactSku = await db.collection('products').findOne({
      userId: user._id.toString(),
      sku: '589'
    });
    console.log(`1. Aniq SKU "589": ${exactSku ? '✅ TOPILDI' : '❌ TOPILMADI'}`);
    if (exactSku) {
      console.log(`   Mahsulot: ${exactSku.name}`);
    }
    
    // 2. Aniq code qidirish
    const exactCode = await db.collection('products').findOne({
      userId: user._id.toString(),
      code: '589'
    });
    console.log(`2. Aniq code "589": ${exactCode ? '✅ TOPILDI' : '❌ TOPILMADI'}`);
    if (exactCode) {
      console.log(`   Mahsulot: ${exactCode.name}`);
    }
    
    // 3. Aniq catalogNumber qidirish
    const exactCatalog = await db.collection('products').findOne({
      userId: user._id.toString(),
      catalogNumber: '589'
    });
    console.log(`3. Aniq catalogNumber "589": ${exactCatalog ? '✅ TOPILDI' : '❌ TOPILMADI'}`);
    if (exactCatalog) {
      console.log(`   Mahsulot: ${exactCatalog.name}`);
    }
    
    // 4. Variant SKU qidirish
    const variantSku = await db.collection('products').findOne({
      userId: user._id.toString(),
      'variantSummaries.sku': '589'
    });
    console.log(`4. Variant SKU "589": ${variantSku ? '✅ TOPILDI' : '❌ TOPILMADI'}`);
    if (variantSku) {
      console.log(`   Mahsulot: ${variantSku.name}`);
      const variant = variantSku.variantSummaries?.find(v => v.sku === '589');
      if (variant) {
        console.log(`   Variant: ${variant.name}`);
      }
    }
    
    // 5. Variant code qidirish
    const variantCode = await db.collection('products').findOne({
      userId: user._id.toString(),
      'variantSummaries.code': '589'
    });
    console.log(`5. Variant code "589": ${variantCode ? '✅ TOPILDI' : '❌ TOPILMADI'}`);
    if (variantCode) {
      console.log(`   Mahsulot: ${variantCode.name}`);
      const variant = variantCode.variantSummaries?.find(v => v.code === '589');
      if (variant) {
        console.log(`   Variant: ${variant.name}`);
      }
    }
    
    // 6. Variant catalogNumber qidirish
    const variantCatalog = await db.collection('products').findOne({
      userId: user._id.toString(),
      'variantSummaries.catalogNumber': '589'
    });
    console.log(`6. Variant catalogNumber "589": ${variantCatalog ? '✅ TOPILDI' : '❌ TOPILMADI'}`);
    if (variantCatalog) {
      console.log(`   Mahsulot: ${variantCatalog.name}`);
      const variant = variantCatalog.variantSummaries?.find(v => v.catalogNumber === '589');
      if (variant) {
        console.log(`   Variant: ${variant.name}`);
      }
    }
    
    // 7. Umumiy qidirish (barcha maydonlar)
    const generalSearch = await db.collection('products').find({
      userId: user._id.toString(),
      $or: [
        { sku: '589' },
        { code: '589' },
        { catalogNumber: '589' },
        { 'variantSummaries.sku': '589' },
        { 'variantSummaries.code': '589' },
        { 'variantSummaries.catalogNumber': '589' },
        { name: { $regex: '589', $options: 'i' } }
      ]
    }).toArray();
    
    console.log(`\n7. Umumiy qidirish natijasi: ${generalSearch.length} ta mahsulot topildi`);
    for (const product of generalSearch) {
      console.log(`   - ${product.name} (SKU: ${product.sku || 'yo\'q'}, Code: ${product.code || 'yo\'q'})`);
      if (product.variantSummaries) {
        for (const variant of product.variantSummaries) {
          if (variant.sku === '589' || variant.code === '589' || variant.catalogNumber === '589') {
            console.log(`     * Variant: ${variant.name} (SKU: ${variant.sku || 'yo\'q'}, Code: ${variant.code || 'yo\'q'})`);
          }
        }
      }
    }
    
    // 8. 589 ni o'z ichiga olgan barcha SKU larni qidirish
    console.log(`\n=== "589" NI O'Z ICHIGA OLGAN SKU LAR ===`);
    const containsSearch = await db.collection('products').find({
      userId: user._id.toString(),
      $or: [
        { sku: { $regex: '589', $options: 'i' } },
        { code: { $regex: '589', $options: 'i' } },
        { catalogNumber: { $regex: '589', $options: 'i' } },
        { 'variantSummaries.sku': { $regex: '589', $options: 'i' } },
        { 'variantSummaries.code': { $regex: '589', $options: 'i' } },
        { 'variantSummaries.catalogNumber': { $regex: '589', $options: 'i' } }
      ]
    }).toArray();
    
    console.log(`"589" ni o'z ichiga olgan: ${containsSearch.length} ta mahsulot`);
    for (const product of containsSearch) {
      console.log(`   - ${product.name}`);
      console.log(`     SKU: ${product.sku || 'yo\'q'}, Code: ${product.code || 'yo\'q'}, Catalog: ${product.catalogNumber || 'yo\'q'}`);
      if (product.variantSummaries) {
        for (const variant of product.variantSummaries) {
          if ((variant.sku && variant.sku.includes('589')) || 
              (variant.code && variant.code.includes('589')) || 
              (variant.catalogNumber && variant.catalogNumber.includes('589'))) {
            console.log(`     * Variant: ${variant.name} (SKU: ${variant.sku || 'yo\'q'}, Code: ${variant.code || 'yo\'q'}, Catalog: ${variant.catalogNumber || 'yo\'q'})`);
          }
        }
      }
    }
    
    // 9. Frontend API endpoint orqali qidirish simulatsiyasi
    console.log(`\n=== FRONTEND API SIMULATSIYASI ===`);
    console.log(`Frontend quyidagi API endpoint ga so'rov yuboradi:`);
    console.log(`GET /api/products?userId=${user._id}`);
    console.log(`Keyin frontend qidirish funksiyasi ishga tushadi...`);
    
    // Frontend qidirish funksiyasini simulatsiya qilish
    const allProducts = await db.collection('products').find({ userId: user._id.toString() }).toArray();
    const searchQuery = '589';
    const q = searchQuery.toLowerCase().trim();
    
    let frontendResults = [];
    
    for (const product of allProducts) {
      // Mahsulot nomi, SKU, kod yoki katalog bo'yicha qidirish
      const productMatches = 
        product.name.toLowerCase().includes(q) || 
        (product.sku || '').toLowerCase().includes(q) ||
        (product.code || '').toLowerCase().includes(q) ||
        (product.catalogNumber || '').toLowerCase().includes(q);
      
      if (productMatches) {
        frontendResults.push({
          type: 'product',
          name: product.name,
          sku: product.sku,
          code: product.code,
          catalogNumber: product.catalogNumber
        });
      }
      
      // Xillarni tekshirish
      if (product.variantSummaries && product.variantSummaries.length > 0) {
        for (const variant of product.variantSummaries) {
          const variantMatches = 
            variant.name.toLowerCase().includes(q) || 
            (variant.sku || '').toLowerCase().includes(q) ||
            (variant.code || '').toLowerCase().includes(q) ||
            (variant.catalogNumber || '').toLowerCase().includes(q);
          
          if (variantMatches) {
            frontendResults.push({
              type: 'variant',
              name: `${variant.name} (${product.name})`,
              sku: variant.sku,
              code: variant.code,
              catalogNumber: variant.catalogNumber
            });
          }
        }
      }
    }
    
    console.log(`Frontend qidirish natijasi: ${frontendResults.length} ta element topildi`);
    for (const result of frontendResults) {
      console.log(`   - ${result.type}: ${result.name}`);
      console.log(`     SKU: ${result.sku || 'yo\'q'}, Code: ${result.code || 'yo\'q'}, Catalog: ${result.catalogNumber || 'yo\'q'}`);
    }
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

testSearch589();