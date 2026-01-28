/**
 * Script to unassign products from user (remove userId)
 * Usage: tsx server/scripts/unassign-products.ts <phone_number>
 * Example: tsx server/scripts/unassign-products.ts +998123456789
 */

import 'dotenv/config';
import { connectMongo } from '../mongo';

async function unassignProducts() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('❌ Использование: tsx server/scripts/unassign-products.ts <phone_number>');
    console.log('');
    console.log('Примеры:');
    console.log('  tsx server/scripts/unassign-products.ts +998123456789');
    console.log('  tsx server/scripts/unassign-products.ts 998123456789');
    console.log('  tsx server/scripts/unassign-products.ts all  # Отвязать ВСЕ товары');
    process.exit(1);
  }

  const phone = args[0];
  const isAll = phone.toLowerCase() === 'all';

  console.log('='.repeat(60));
  console.log('ОТВЯЗКА ТОВАРОВ ОТ ПОЛЬЗОВАТЕЛЯ');
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

    let userId: string | null = null;
    let userName = 'ВСЕ пользователи';

    if (!isAll) {
      // Find user
      console.log('[1/4] Поиск пользователя...');
      const normalizedPhone = phone.replace(/[^\d]/g, '');
      console.log(`Телефон: ${normalizedPhone}`);
      console.log();

      const user = await usersCollection.findOne({ 
        phone: { $regex: normalizedPhone, $options: 'i' } 
      });

      if (!user) {
        console.error('❌ Пользователь не найден');
        process.exit(1);
      }

      userId = user._id.toString();
      userName = user.name;

      console.log('✅ Пользователь найден:');
      console.log(`   Имя: ${user.name}`);
      console.log(`   Телефон: ${user.phone}`);
      console.log(`   ID: ${userId}`);
      console.log(`   Роль: ${user.role}`);
      console.log();
    } else {
      console.log('[1/4] Режим: Отвязка ВСЕХ товаров');
      console.log();
    }

    // Find products
    console.log('[2/4] Поиск товаров...');
    
    const filter = isAll ? {} : { userId: userId };
    const userProducts = await productsCollection.find(filter).toArray();

    console.log(`Найдено товаров: ${userProducts.length}`);
    
    if (userProducts.length === 0) {
      console.log('✅ Нет товаров для отвязки');
      process.exit(0);
    }

    console.log();
    console.log('Примеры товаров:');
    userProducts.slice(0, 5).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} (SKU: ${p.sku || 'нет'}, userId: ${p.userId || 'нет'})`);
    });
    if (userProducts.length > 5) {
      console.log(`   ... и еще ${userProducts.length - 5} товаров`);
    }
    console.log();

    // Confirm
    console.log('[3/4] Подтверждение...');
    console.log(`⚠️  Будет отвязано ${userProducts.length} товаров от: ${userName}`);
    console.log('   После этого товары станут "ничьими" (без владельца)');
    console.log();

    // Wait 2 seconds
    console.log('Начинаем через 2 секунды...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update products - remove userId
    console.log('[4/4] Обновление товаров...');
    
    const result = await productsCollection.updateMany(
      filter,
      {
        $unset: { userId: '' }
      }
    );

    console.log();
    console.log('='.repeat(60));
    console.log('РЕЗУЛЬТАТ');
    console.log('='.repeat(60));
    console.log(`✅ Отвязано товаров: ${result.modifiedCount}`);
    console.log(`   От: ${userName}`);
    if (userId) {
      console.log(`   User ID: ${userId}`);
    }
    console.log('='.repeat(60));
    console.log();
    console.log('🎉 Готово! Товары теперь без владельца (ничьи).');

    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

unassignProducts();
