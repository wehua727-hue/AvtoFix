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

async function findAllDuplicates() {
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
    
    console.log(`\n=== BARCHA DUBLIKAT KODLARNI QIDIRISH ===`);
    console.log(`Jami mahsulotlar: ${products.length}`);
    
    // Barcha kodlarni to'plash (SKU, code, catalogNumber)
    const codeMap = new Map<string, Array<{ 
      productId: string, 
      productName: string, 
      type: 'main' | 'variant', 
      variantName?: string,
      fieldType: 'sku' | 'code' | 'catalogNumber'
    }>>();
    
    for (const product of products) {
      // Asosiy mahsulot kodlari
      if (product.sku) {
        const code = product.sku.trim();
        if (!codeMap.has(code)) {
          codeMap.set(code, []);
        }
        codeMap.get(code)!.push({
          productId: product._id.toString(),
          productName: product.name,
          type: 'main',
          fieldType: 'sku'
        });
      }
      
      if (product.code) {
        const code = product.code.trim();
        if (!codeMap.has(code)) {
          codeMap.set(code, []);
        }
        codeMap.get(code)!.push({
          productId: product._id.toString(),
          productName: product.name,
          type: 'main',
          fieldType: 'code'
        });
      }
      
      if (product.catalogNumber) {
        const code = product.catalogNumber.trim();
        if (!codeMap.has(code)) {
          codeMap.set(code, []);
        }
        codeMap.get(code)!.push({
          productId: product._id.toString(),
          productName: product.name,
          type: 'main',
          fieldType: 'catalogNumber'
        });
      }
      
      // Variant kodlari
      if (product.variantSummaries) {
        for (const variant of product.variantSummaries) {
          if (variant.sku) {
            const code = variant.sku.trim();
            if (!codeMap.has(code)) {
              codeMap.set(code, []);
            }
            codeMap.get(code)!.push({
              productId: product._id.toString(),
              productName: product.name,
              type: 'variant',
              variantName: variant.name,
              fieldType: 'sku'
            });
          }
          
          if (variant.code) {
            const code = variant.code.trim();
            if (!codeMap.has(code)) {
              codeMap.set(code, []);
            }
            codeMap.get(code)!.push({
              productId: product._id.toString(),
              productName: product.name,
              type: 'variant',
              variantName: variant.name,
              fieldType: 'code'
            });
          }
          
          if (variant.catalogNumber) {
            const code = variant.catalogNumber.trim();
            if (!codeMap.has(code)) {
              codeMap.set(code, []);
            }
            codeMap.get(code)!.push({
              productId: product._id.toString(),
              productName: product.name,
              type: 'variant',
              variantName: variant.name,
              fieldType: 'catalogNumber'
            });
          }
        }
      }
    }
    
    // Dublikat kodlarni topish
    console.log(`\n=== BARCHA DUBLIKAT KODLAR ===`);
    let duplicatesFound = 0;
    const duplicateCodes: string[] = [];
    
    for (const [code, items] of codeMap.entries()) {
      if (items.length > 1) {
        duplicatesFound++;
        duplicateCodes.push(code);
        console.log(`\n🔴 DUBLIKAT KOD: "${code}" (${items.length} marta ishlatilgan)`);
        
        for (const item of items) {
          if (item.type === 'main') {
            console.log(`  - Mahsulot: ${item.productName}`);
            console.log(`    ID: ${item.productId}, Maydon: ${item.fieldType}`);
          } else {
            console.log(`  - Variant: ${item.variantName} in ${item.productName}`);
            console.log(`    ID: ${item.productId}, Maydon: ${item.fieldType}`);
          }
        }
      }
    }
    
    console.log(`\n=== STATISTIKA ===`);
    console.log(`Jami noyob kodlar: ${codeMap.size}`);
    console.log(`Dublikat kodlar: ${duplicatesFound}`);
    
    if (duplicatesFound > 0) {
      console.log(`\nDublikat kodlar ro'yxati: ${duplicateCodes.join(', ')}`);
      
      // Eng ko'p takrorlangan kodlarni topish
      const sortedDuplicates = Array.from(codeMap.entries())
        .filter(([_, items]) => items.length > 1)
        .sort((a, b) => b[1].length - a[1].length);
      
      console.log(`\n=== ENG KO'P TAKRORLANGAN KODLAR ===`);
      for (let i = 0; i < Math.min(5, sortedDuplicates.length); i++) {
        const [code, items] = sortedDuplicates[i];
        console.log(`${i + 1}. "${code}" - ${items.length} marta`);
      }
      
      // Raqamli kodlarni alohida tekshirish
      console.log(`\n=== RAQAMLI DUBLIKAT KODLAR ===`);
      const numericDuplicates = duplicateCodes
        .filter(code => /^\d+$/.test(code))
        .map(code => parseInt(code))
        .sort((a, b) => a - b);
      
      if (numericDuplicates.length > 0) {
        console.log(`Raqamli dublikat kodlar: ${numericDuplicates.join(', ')}`);
        
        // Kichik raqamli dublikatlarni ko'rsatish
        const smallDuplicates = numericDuplicates.filter(num => num <= 100);
        if (smallDuplicates.length > 0) {
          console.log(`\n100 dan kichik dublikat kodlar:`);
          for (const num of smallDuplicates) {
            const code = num.toString();
            const items = codeMap.get(code)!;
            console.log(`  ${num}: ${items.length} marta ishlatilgan`);
            for (const item of items) {
              if (item.type === 'main') {
                console.log(`    - Mahsulot: ${item.productName} (${item.fieldType})`);
              } else {
                console.log(`    - Variant: ${item.variantName} (${item.fieldType})`);
              }
            }
          }
        }
      }
      
    } else {
      console.log(`✅ Hech qanday dublikat kod topilmadi!`);
    }
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

findAllDuplicates();