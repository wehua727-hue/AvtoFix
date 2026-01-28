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

async function createSku589() {
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
    
    // 589 SKU sini tekshirish
    const sku589Product = products.find(p => 
      p.sku === '589' || 
      p.code === '589' || 
      p.catalogNumber === '589' ||
      (p.variantSummaries && p.variantSummaries.some(v => 
        v.sku === '589' || v.code === '589' || v.catalogNumber === '589'
      ))
    );
    
    if (sku589Product) {
      console.log(`✅ SKU "589" allaqachon mavjud: ${sku589Product.name}`);
      return;
    }
    
    console.log(`❌ SKU "589" topilmadi. Yangi mahsulot yaratilmoqda...`);
    
    // SKU 589 bilan yangi mahsulot yaratish
    const newProduct = {
      userId: user._id.toString(),
      name: 'Test mahsulot - SKU 589',
      sku: '589',
      code: '589',
      catalogNumber: '589',
      sizes: [],
      images: [],
      price: 100000,
      basePrice: 100000,
      priceMultiplier: 1,
      currency: 'UZS',
      categoryId: '',
      stock: 10,
      initialStock: 10,
      status: 'available',
      description: 'Bu SKU 589 qidirish uchun yaratilgan test mahsulot',
      imageUrl: '',
      variantSummaries: [],
      childProducts: [],
      isHidden: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('products').insertOne(newProduct);
    
    if (result.insertedId) {
      console.log(`✅ Yangi mahsulot yaratildi!`);
      console.log(`   ID: ${result.insertedId}`);
      console.log(`   Nomi: ${newProduct.name}`);
      console.log(`   SKU: ${newProduct.sku}`);
      console.log(`   Code: ${newProduct.code}`);
      console.log(`   Catalog Number: ${newProduct.catalogNumber}`);
      
      // Yangi statistika
      const updatedProducts = await db.collection<Product>('products').find({ userId: user._id.toString() }).toArray();
      console.log(`\n=== YANGILANGAN STATISTIKA ===`);
      console.log(`Jami mahsulotlar: ${updatedProducts.length}`);
      
      // 589 ni qidirish
      console.log(`\n=== SKU "589" QIDIRISH TESTI ===`);
      const foundProduct = await db.collection('products').findOne({
        userId: user._id.toString(),
        $or: [
          { sku: '589' },
          { code: '589' },
          { catalogNumber: '589' },
          { 'variantSummaries.sku': '589' },
          { 'variantSummaries.code': '589' },
          { 'variantSummaries.catalogNumber': '589' }
        ]
      });
      
      if (foundProduct) {
        console.log(`✅ SKU "589" muvaffaqiyatli topildi!`);
        console.log(`   Mahsulot: ${foundProduct.name}`);
      } else {
        console.log(`❌ SKU "589" hali ham topilmadi!`);
      }
      
    } else {
      console.log(`❌ Mahsulot yaratishda xatolik!`);
    }
    
  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

createSku589();