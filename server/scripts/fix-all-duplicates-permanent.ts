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

async function fixAllDuplicatesPermanent() {
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
    
    console.log(`\n=== BARCHA DUBLIKAT KODLARNI TUZATISH ===`);
    console.log(`Jami mahsulotlar: ${products.length}`);
    
    // Barcha kodlarni to'plash (faqat SKU maydonini tekshiramiz)
    const skuMap = new Map<string, Array<{ 
      productId: string, 
      productName: string, 
      type: 'main' | 'variant', 
      variantName?: string,
      variantIndex?: number
    }>>();
    
    for (const product of products) {
      // Asosiy mahsulot SKU si
      if (product.sku) {
        const sku = product.sku.trim();
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
        for (let i = 0; i < product.variantSummaries.length; i++) {
          const variant = product.variantSummaries[i];
          if (variant.sku) {
            const sku = variant.sku.trim();
            if (!skuMap.has(sku)) {
              skuMap.set(sku, []);
            }
            skuMap.get(sku)!.push({
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
    
    // Dublikat SKU larni topish va tuzatish
    console.log(`\n=== DUBLIKAT SKU LARNI TUZATISH ===`);
    let duplicatesFixed = 0;
    let totalDuplicates = 0;
    
    // Eng katta SKU raqamini topish
    let maxSku = 0;
    for (const [sku] of skuMap) {
      const skuNum = parseInt(sku);
      if (!isNaN(skuNum) && skuNum > maxSku) {
        maxSku = skuNum;
      }
    }
    
    console.log(`Hozirgi eng katta SKU: ${maxSku}`);
    let nextAvailableSku = maxSku + 1;
    
    for (const [sku, items] of skuMap.entries()) {
      if (items.length > 1) {
        totalDuplicates++;
        console.log(`\n🔴 DUBLIKAT SKU: "${sku}" (${items.length} marta ishlatilgan)`);
        
        // Birinchi elementni saqlab qolamiz, qolganlarini o'zgartiramiz
        for (let i = 1; i < items.length; i++) {
          const item = items[i];
          const newSku = nextAvailableSku.toString();
          nextAvailableSku++;
          
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
    console.log(`Topilgan dublikatlar: ${totalDuplicates}`);
    console.log(`Tuzatilgan dublikatlar: ${duplicatesFixed}`);
    console.log(`Yangi eng katta SKU: ${nextAvailableSku - 1}`);
    
    if (duplicatesFixed > 0) {
      console.log(`\n✅ ${duplicatesFixed} ta dublikat SKU muvaffaqiyatli tuzatildi!`);
      console.log(`Endi barcha SKU lar noyob bo'lishi kerak.`);
      
      // Tekshirish - yana dublikatlar bormi?
      console.log(`\n=== TEKSHIRISH - YANA DUBLIKATLAR BORMI? ===`);
      const updatedProducts = await db.collection<Product>('products').find({ userId: user._id.toString() }).toArray();
      
      const newSkuMap = new Map<string, number>();
      let totalSkus = 0;
      
      for (const product of updatedProducts) {
        if (product.sku) {
          const sku = product.sku.trim();
          newSkuMap.set(sku, (newSkuMap.get(sku) || 0) + 1);
          totalSkus++;
        }
        
        if (product.variantSummaries) {
          for (const variant of product.variantSummaries) {
            if (variant.sku) {
              const sku = variant.sku.trim();
              newSkuMap.set(sku, (newSkuMap.get(sku) || 0) + 1);
              totalSkus++;
            }
          }
        }
      }
      
      const remainingDuplicates = Array.from(newSkuMap.values()).filter(count => count > 1).length;
      
      if (remainingDuplicates === 0) {
        console.log(`✅ Ajoyib! Endi hech qanday dublikat SKU yo'q!`);
        console.log(`Jami SKU lar: ${totalSkus}`);
        console.log(`Noyob SKU lar: ${newSkuMap.size}`);
      } else {
        console.log(`❌ Hali ham ${remainingDuplicates} ta dublikat qoldi!`);
      }
      
    } else {
      console.log(`\n✅ Hech qanday dublikat topilmadi yoki tuzatilmadi.`);
    }
    
    // 589 SKU ni tekshirish
    console.log(`\n=== SKU "589" TEKSHIRISH ===`);
    const sku589Product = await db.collection('products').findOne({
      userId: user._id.toString(),
      $or: [
        { sku: '589' },
        { 'variantSummaries.sku': '589' }
      ]
    });
    
    if (sku589Product) {
      console.log(`✅ SKU "589" mavjud: ${sku589Product.name}`);
      if (sku589Product.sku === '589') {
        console.log(`   Asosiy mahsulot SKU: 589`);
      }
      if (sku589Product.variantSummaries) {
        for (const variant of sku589Product.variantSummaries) {
          if (variant.sku === '589') {
            console.log(`   Variant SKU: 589 (${variant.name})`);
          }
        }
      }
    } else {
      console.log(`❌ SKU "589" topilmadi!`);
    }
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

fixAllDuplicatesPermanent();