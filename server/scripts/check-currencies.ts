import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/avtofix';

async function checkCurrencies() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi');
    
    const db = client.db();
    const collection = db.collection('products');
    
    // Barcha mahsulotlarni tekshirish
    const products = await collection.find({}).limit(20).toArray();
    
    console.log('\n📊 Mahsulotlar valyutasi:');
    console.log('='.repeat(80));
    
    const currencyStats: Record<string, number> = {};
    
    for (const product of products) {
      const currency = product.currency || 'UNDEFINED';
      currencyStats[currency] = (currencyStats[currency] || 0) + 1;
      
      console.log(`SKU: ${product.productSku?.padEnd(10)} | Currency: ${currency?.padEnd(10)} | Name: ${product.name?.substring(0, 40)}`);
    }
    
    console.log('\n📈 Valyuta statistikasi:');
    console.log('='.repeat(80));
    for (const [currency, count] of Object.entries(currencyStats)) {
      console.log(`${currency}: ${count} ta mahsulot`);
    }
    
    // Variantlarni ham tekshirish
    const productsWithVariants = await collection.find({ 
      variantSummaries: { $exists: true, $ne: [] } 
    }).limit(10).toArray();
    
    if (productsWithVariants.length > 0) {
      console.log('\n🔍 Variantlar valyutasi:');
      console.log('='.repeat(80));
      
      for (const product of productsWithVariants) {
        console.log(`\nMahsulot: ${pr