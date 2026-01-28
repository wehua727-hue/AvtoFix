/**
 * Script to check products by user
 * Shows which products belong to which user
 */

import 'dotenv/config';
import { connectMongo } from '../mongo';

async function checkProductsByUser() {
  console.log('='.repeat(60));
  console.log('ПРОВЕРКА ТОВАРОВ ПО ПОЛЬЗОВАТЕЛЯМ');
  console.log('='.repeat(60));
  console.log();

  try {
    const conn = await connectMongo();
    if (!conn?.db) {
      console.error('❌ Не удалось подключиться к базе данных');
      process.exit(1);
    }

    const db = conn.db;
    const productsCollection = db.collection('products');
    const usersCollection = db.collection('users');

    // Get all users
    const users = await usersCollection.find({}).toArray();
    console.log(`Найдено пользователей: ${users.length}`);
    console.log();

    // Get all products
    const allProducts = await productsCollection.find({}).toArray();
    console.log(`Всего товаров в БД: ${allProducts.length}`);
    console.log();

    // Group products by userId
    const productsByUser = new Map<string, any[]>();
    const productsWithoutUser: any[] = [];

    for (const product of allProducts) {
      if (!product.userId) {
        productsWithoutUser.push(product);
      } else {
        const userId = String(product.userId);
        if (!productsByUser.has(userId)) {
          productsByUser.set(userId, []);
        }
        productsByUser.get(userId)!.push(product);
      }
    }

    console.log('='.repeat(60));
    console.log('ТОВАРЫ БЕЗ ВЛАДЕЛЬЦА (userId не указан)');
    console.log('='.repeat(60));
    console.log(`Количество: ${productsWithoutUser.length}`);
    if (productsWithoutUser.length > 0) {
      productsWithoutUser.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name} (SKU: ${p.sku || 'нет'})`);
      });
      if (productsWithoutUser.length > 5) {
        console.log(`... и еще ${productsWithoutUser.length - 5} товаров`);
      }
    }
    console.log();

    console.log('='.repeat(60));
    console.log('ТОВАРЫ ПО ПОЛЬЗОВАТЕЛЯМ');
    console.log('='.repeat(60));

    for (const user of users) {
      const userId = String(user._id);
      const userProducts = productsByUser.get(userId) || [];
      
      console.log();
      console.log(`👤 ${user.name} (${user.phone})`);
      console.log(`   ID: ${userId}`);
      console.log(`   Роль: ${user.role}`);
      console.log(`   Товаров: ${userProducts.length}`);
      
      if (userProducts.length > 0) {
        userProducts.slice(0, 3).forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.name} (SKU: ${p.sku || 'нет'})`);
        });
        if (userProducts.length > 3) {
          console.log(`   ... и еще ${userProducts.length - 3} товаров`);
        }
      }
    }

    console.log();
    console.log('='.repeat(60));
    console.log('ПРОВЕРКА ФИЛЬТРАЦИИ');
    console.log('='.repeat(60));

    // Test filtering for each user
    for (const user of users.slice(0, 3)) { // Test first 3 users
      const userId = String(user._id);
      const userPhone = user.phone;
      
      console.log();
      console.log(`Тест для: ${user.name} (${userPhone})`);
      
      // Simulate server filtering logic
      const normalizedUserPhone = userPhone.replace(/[^\d]/g, '');
      const isAdminPhone = normalizedUserPhone === '910712828' || normalizedUserPhone.endsWith('910712828');
      
      let filter: any = {};
      
      if (isAdminPhone && userId) {
        filter = {
          $or: [
            { userId: { $exists: false } },
            { userId: null },
            { userId: '' },
            { userId: userId }
          ]
        };
        console.log('   Тип: АДМИН (видит свои + без владельца)');
      } else if (userId) {
        filter = { userId: userId };
        console.log('   Тип: ОБЫЧНЫЙ (видит только свои)');
      }
      
      const filteredProducts = await productsCollection.find(filter).toArray();
      console.log(`   Фильтр: ${JSON.stringify(filter)}`);
      console.log(`   Результат: ${filteredProducts.length} товаров`);
      
      if (filteredProducts.length > 0) {
        filteredProducts.slice(0, 2).forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.name} (userId: ${p.userId || 'нет'})`);
        });
      }
    }

    console.log();
    console.log('='.repeat(60));
    console.log('✅ Проверка завершена');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

checkProductsByUser();
