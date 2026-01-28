import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oflayn-dokon';
const DB_NAME = process.env.DB_NAME || 'avtofix';

// Foydalanuvchi ma'lumotlari
const USER_PHONE = '910712828';
const USER_PASSWORD = 'avtofix202508';

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

async function findDuplicateSkus() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    console.log('Database name:', DB_NAME);
    
    const db = client.db(DB_NAME);
    
    // Foydalanuvchini topish
    console.log(`\n=== SEARCHING FOR USER WITH PHONE: ${USER_PHONE} ===`);
    
    // Avval barcha foydalanuvchilarni ko'rib chiqamiz
    const allUsers = await db.collection<User>('users').find({}).toArray();
    console.log(`Total users in database: ${allUsers.length}`);
    
    // Telefon raqami bilan bog'liq foydalanuvchilarni qidiramiz
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
        console.log(`✅ User found with phone format: ${phoneVariant}`);
        break;
      }
    }
    
    // Agar topilmasa, o'xshash telefon raqamlarini qidiramiz
    if (!user) {
      console.log('❌ User not found with exact phone. Searching for similar phones...');
      const similarUsers = await db.collection<User>('users').find({
        phone: { $regex: USER_PHONE, $options: 'i' }
      }).toArray();
      
      if (similarUsers.length > 0) {
        console.log(`Found ${similarUsers.length} users with similar phone numbers:`);
        for (const u of similarUsers) {
          console.log(`  - ${u.name} (${u.phone}) - Role: ${u.role}`);
        }
        user = similarUsers[0]; // Birinchisini tanlaymiz
        console.log(`Using first match: ${user.name} (${user.phone})`);
      } else {
        console.log('❌ No users found with similar phone numbers!');
        console.log('Available users:');
        for (const u of allUsers.slice(0, 10)) { // Faqat birinchi 10 tasini ko'rsatamiz
          console.log(`  - ${u.name} (${u.phone}) - Role: ${u.role}`);
        }
        return;
      }
    }
    
    console.log(`✅ User found: ${user.name} (ID: ${user._id})`);
    console.log(`   Role: ${user.role}`);
    
    // Foydalanuvchining mahsulotlarini olish
    const products = await db.collection<Product>('products').find({ userId: user._id.toString() }).toArray();
    
    console.log(`\n=== USER'S PRODUCTS ANALYSIS ===`);
    console.log(`Found ${products.length} products for user ${user.name}`);
    
    if (products.length === 0) {
      console.log('❌ No products found for this user!');
      return;
    }
    
    // SKU larni to'plash
    const skuMap = new Map<string, Array<{ productId: string, productName: string, type: 'main' | 'variant', variantName?: string }>>();
    
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
        for (const variant of product.variantSummaries) {
          const variantSku = variant.sku?.trim();
          if (variantSku) {
            if (!skuMap.has(variantSku)) {
              skuMap.set(variantSku, []);
            }
            skuMap.get(variantSku)!.push({
              productId: product._id.toString(),
              productName: product.name,
              type: 'variant',
              variantName: variant.name
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
              variantName: variant.name
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
              variantName: variant.name
            });
          }
        }
      }
    }
    
    // Dublikatlarni topish
    console.log('\n=== DUPLICATE SKUs/CODES FOUND ===');
    let duplicatesFound = false;
    
    for (const [sku, items] of skuMap.entries()) {
      if (items.length > 1) {
        duplicatesFound = true;
        console.log(`\n🔴 DUPLICATE SKU/CODE: "${sku}" (${items.length} ta mahsulot)`);
        for (const item of items) {
          if (item.type === 'main') {
            console.log(`  - Mahsulot: ${item.productName} (ID: ${item.productId})`);
          } else {
            console.log(`  - Variant: ${item.variantName} in ${item.productName} (ID: ${item.productId})`);
          }
        }
      }
    }
    
    if (!duplicatesFound) {
      console.log('✅ No duplicate SKUs/codes found!');
    }
    
    // 589 kodini alohida tekshirish
    console.log('\n=== SEARCHING FOR SKU "589" ===');
    const sku589Items = skuMap.get('589');
    if (sku589Items) {
      console.log(`✅ Found ${sku589Items.length} items with SKU "589":`);
      for (const item of sku589Items) {
        if (item.type === 'main') {
          console.log(`  - Mahsulot: ${item.productName} (ID: ${item.productId})`);
        } else {
          console.log(`  - Variant: ${item.variantName} in ${item.productName} (ID: ${item.productId})`);
        }
      }
    } else {
      console.log('❌ SKU "589" not found!');
      
      // 589 ni o'z ichiga olgan SKU larni qidirish
      console.log('\n🔍 Searching for SKUs containing "589":');
      let found589Related = false;
      for (const [sku, items] of skuMap.entries()) {
        if (sku.includes('589')) {
          found589Related = true;
          console.log(`  - SKU: "${sku}" in ${items.length} items`);
          for (const item of items) {
            if (item.type === 'main') {
              console.log(`    * Mahsulot: ${item.productName} (ID: ${item.productId})`);
            } else {
              console.log(`    * Variant: ${item.variantName} in ${item.productName} (ID: ${item.productId})`);
            }
          }
        }
      }
      
      if (!found589Related) {
        console.log('❌ No SKUs containing "589" found either!');
      }
    }
    
    // Umumiy statistika
    console.log('\n=== STATISTICS ===');
    console.log(`Total products: ${products.length}`);
    console.log(`Total unique SKUs/codes: ${skuMap.size}`);
    console.log(`Duplicate SKUs/codes: ${Array.from(skuMap.values()).filter(items => items.length > 1).length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

findDuplicateSkus();