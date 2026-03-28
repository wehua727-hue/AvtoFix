/**
 * Excel fayldan mahsulotlarni to'g'ridan-to'g'ri MongoDB'ga import qilish
 * 
 * Foydalanish:
 * 1. Excel faylni `products-import.xlsx` nomi bilan AvtoFix papkasiga qo'ying
 * 2. npx tsx scripts/import-from-excel.ts
 */

import { MongoClient } from 'mongodb';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'avtofix';
const PRODUCTS_COLLECTION = 'products';
const USER_ID = '6974aea9af7ded62a69472c4'; // Hozirgi login qilgan user

async function main() {
  console.log('========================================');
  console.log('Excel dan MongoDB ga Import');
  console.log('========================================\n');

  // Excel faylni o'qish
  const excelPath = path.join(process.cwd(), 'products-import.xlsx');
  
  if (!fs.existsSync(excelPath)) {
    console.log('❌ products-import.xlsx fayli topilmadi!');
    console.log('\n📝 Qadamlar:');
    console.log('   1. Excel faylni AvtoFix papkasiga qo\'ying');
    console.log('   2. Nomini products-import.xlsx ga o\'zgartiring');
    console.log('   3. Bu scriptni qayta ishga tushiring\n');
    return;
  }

  console.log('✅ Excel fayl topildi\n');
  console.log('📖 Excel faylni o\'qish...\n');

  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`✅ ${data.length} ta mahsulot o'qildi\n`);

  if (data.length === 0) {
    console.log('❌ Excel faylda mahsulotlar yo\'q!\n');
    return;
  }

  // Birinchi 5 ta mahsulotni ko'rsatish
  console.log('📋 Birinchi 5 ta mahsulot:\n');
  data.slice(0, 5).forEach((row: any, index: number) => {
    console.log(`${index + 1}. ${row['Наименование'] || row['Nomi'] || row['Name']} (SKU: ${row['Код'] || row['SKU'] || row['Kod']})`);
  });
  console.log('');

  // MongoDB'ga ulanish
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ MongoDB ga ulandi\n');

    const db = client.db(DB_NAME);
    const productsCollection = db.collection(PRODUCTS_COLLECTION);

    console.log('🔄 Mahsulotlarni import qilish...\n');

    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];
      
      // Excel ustunlarini aniqlash (turli formatlar uchun)
      const name = row['Наименование'] || row['Nomi'] || row['Name'] || row['name'];
      const sku = row['Код'] || row['SKU'] || row['Kod'] || row['sku'];
      const price = parseFloat(row['Цена'] || row['Narx'] || row['Price'] || row['price'] || '0');
      const stock = parseInt(row['Кол-во'] || row['Stock'] || row['Miqdor'] || row['stock'] || '0');
      const currency = row['Валюта'] || row['Currency'] || 'UZS';

      if (!name || !sku) {
        console.log(`⚠️  O'tkazib yuborildi (${i + 1}): Nom yoki SKU yo'q`);
        skippedCount++;
        continue;
      }

      // Dublikat tekshiruvi
      const existing = await productsCollection.findOne({ sku: sku.toString(), userId: USER_ID });
      if (existing) {
        console.log(`⚠️  O'tkazib yuborildi (${i + 1}): ${name} (SKU: ${sku}) - allaqachon mavjud`);
        skippedCount++;
        continue;
      }

      // Mahsulotni qo'shish
      try {
        const product: any = {
          name: name.toString(),
          sku: sku.toString(),
          price: price || 0,
          stock: stock || 0,
          initialStock: stock || 0,
          currency: currency || 'UZS',
          userId: USER_ID,
          status: 'available',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await productsCollection.insertOne(product);
        
        if ((i + 1) % 100 === 0) {
          console.log(`✅ Import qilindi: ${i + 1} / ${data.length}`);
        }
        
        importedCount++;
      } catch (err) {
        console.log(`❌ Xatolik (${i + 1}): ${name} - ${err}`);
        errorCount++;
      }
    }

    console.log('\n========================================');
    console.log(`✅ Jami import qilindi: ${importedCount} ta`);
    console.log(`⚠️  O'tkazib yuborildi: ${skippedCount} ta`);
    console.log(`❌ Xatoliklar: ${errorCount} ta`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Xatolik:', error);
  } finally {
    await client.close();
  }
}

main();
