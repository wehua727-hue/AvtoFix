/**
 * Script to assign products to a user
 * Usage: tsx server/scripts/assign-products-to-user.ts <phone_number>
 * Example: tsx server/scripts/assign-products-to-user.ts +998123456789
 */

import 'dotenv/config';
import { connectMongo } from '../mongo';

async function assignProductsToUser() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('❌ Использование: tsx server/scripts/assign-products-to-user.ts <phone_number>');
    console.log('');
    console.log('Примеры:');
    console.log('  tsx server/scripts/assign-products-to-user.ts +998123456789');
    console.log('  tsx server/scripts/assign-products-to-user.ts 998123456789');
    process.exit(1);
  }

  const phone = args[0].replace(/[^\d]/g, ''); // Только цифры

  console.log('='.repeat(60));
  console.log('ПРИВЯЗКА ТОВАРОВ К ПОЛЬЗОВАТЕЛЮ');
  console.log('='.repeat(60));
  console.log();

  try {
    const conn = await connectMongo();
    if (!conn?.db) {
      console.error('❌ Не удалось подключиться к базе данных');
      process.exit(1);
    }

    const db = conn.db;
    const usersCollection = db.collection('users');
    const productsCollection = db.collection('products');

    // Find user
    console.log('[1/4] Поиск пользователя...');
    console.log(`Телефон: ${phone}`);
    console.log();

    const user = await usersCollection.findOne({ 
      phone: { $regex: phone, $options: 'i' } 
    });

    if (!user) {
      console.error('❌ Пользователь не найден');
      process.exit(1);
    }

    console.log('✅ Пользователь найден:');
    console.log(`   Имя: ${user.name}`);
    console.log(`   Телефон: ${user.phone}`);
    console.log(`   ID: ${user._id}`);
    console.log(`   Роль: ${user.role}`);
    console.log();

    // Find products without userId
    console.log('[2/4] Поиск товаров без владельца...');
    
    const productsWithoutOwner = await productsCollection.find({
      $or: [
        { userId: { $exists: false } },
        { userId: null },
        { userId: '' }
      ]
    }).toArray();

    console.log(`Найдено товаров без владельца: ${productsWithoutOwner.length}`);
    
    if (productsWithoutOwner.length === 0) {
      console.log('✅ Все товары уже привязаны к пользователям');
      process.exit(0);
    }

    console.log();
    console.log('Примеры товаров:');
    productsWithoutOwner.slice(0, 5).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} (SKU: ${p.sku || 'нет'})`);
    });
    if (productsWithoutOwner.length > 5) {
      console.log(`   ... и еще ${productsWithoutOwner.length - 5} товаров`);
    }
    console.log();

    // Confirm
    console.log('[3/4] Подтверждение...');
    console.log(`⚠️  Будет привязано ${productsWithoutOwner.length} товаров к пользователю ${user.name}`);
    console.log();

    // Wait 2 seconds
    console.log('Начинаем через 2 секунды...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update products
    console.log('[4/4] Обновление товаров...');
    
    const result = await productsCollection.updateMany(
      {
        $or: [
          { userId: { $exists: false } },
          { userId: null },
          { userId: '' }
        ]
      },
      {
        $set: { userId: user._id.toString() }
      }
    );

    console.log();
    console.log('='.repeat(60));
    console.log('РЕЗУЛЬТАТ');
    console.log('='.repeat(60));
    console.log(`✅ Обновлено товаров: ${result.modifiedCount}`);
    console.log(`   Пользователь: ${user.name}`);
    console.log(`   Телефон: ${user.phone}`);
    console.log(`   User ID: ${user._id}`);
    console.log('='.repeat(60));
    console.log();
    console.log('🎉 Готово! Теперь эти товары будут видны только этому пользователю.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

assignProductsToUser();
