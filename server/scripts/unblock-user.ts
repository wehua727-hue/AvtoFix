/**
 * Script to unblock user and extend subscription
 * Usage: tsx server/scripts/unblock-user.ts <phone_number> <days>
 * Example: tsx server/scripts/unblock-user.ts +998901234567 30
 */

import 'dotenv/config';
import { connectMongo } from '../mongo';

async function unblockUser() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('❌ Использование: tsx server/scripts/unblock-user.ts <phone_number> [days]');
    console.log('');
    console.log('Примеры:');
    console.log('  tsx server/scripts/unblock-user.ts +998901234567 30  # Разблокировать и продлить на 30 дней');
    console.log('  tsx server/scripts/unblock-user.ts +998901234567     # Только разблокировать');
    process.exit(1);
  }

  const phone = args[0];
  const daysToAdd = args[1] ? parseInt(args[1]) : 0;

  console.log('='.repeat(60));
  console.log('РАЗБЛОКИРОВКА ПОЛЬЗОВАТЕЛЯ');
  console.log('='.repeat(60));
  console.log();

  try {
    // Connect to MongoDB
    console.log('[1/4] Подключение к MongoDB...');
    const conn = await connectMongo();
    if (!conn?.db) {
      console.error('❌ Не удалось подключиться к базе данных');
      process.exit(1);
    }
    console.log('✅ Подключено к MongoDB');
    console.log();

    const db = conn.db;
    const usersCollection = db.collection('users');

    // Find user
    console.log('[2/4] Поиск пользователя...');
    console.log(`Телефон: ${phone}`);
    console.log();

    const user = await usersCollection.findOne({ phone });

    if (!user) {
      console.error('❌ Пользователь не найден');
      process.exit(1);
    }

    console.log('✅ Пользователь найден:');
    console.log(`   Имя: ${user.name}`);
    console.log(`   Телефон: ${user.phone}`);
    console.log(`   Роль: ${user.role}`);
    console.log(`   Тип подписки: ${user.subscriptionType || 'не указан'}`);
    console.log(`   Дата окончания: ${user.subscriptionEndDate ? new Date(user.subscriptionEndDate).toLocaleDateString('ru-RU') : 'не указана'}`);
    console.log(`   Заблокирован: ${user.isBlocked ? '✅ ДА' : '❌ НЕТ'}`);
    console.log();

    // Prepare update
    console.log('[3/4] Подготовка изменений...');
    
    const updateData: any = {
      isBlocked: false,
    };

    if (daysToAdd > 0) {
      const currentEndDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : new Date();
      const now = new Date();
      
      // If subscription already expired, start from now
      const startDate = currentEndDate > now ? currentEndDate : now;
      
      const newEndDate = new Date(startDate);
      newEndDate.setDate(newEndDate.getDate() + daysToAdd);
      
      updateData.subscriptionEndDate = newEndDate;
      
      console.log(`   Текущая дата окончания: ${currentEndDate.toLocaleDateString('ru-RU')}`);
      console.log(`   Новая дата окончания: ${newEndDate.toLocaleDateString('ru-RU')}`);
      console.log(`   Добавлено дней: ${daysToAdd}`);
    } else {
      console.log('   Только разблокировка (дата не меняется)');
    }
    console.log();

    // Update user
    console.log('[4/4] Обновление пользователя...');
    
    const result = await usersCollection.updateOne(
      { phone },
      { $set: updateData }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Пользователь успешно обновлен!');
      console.log();
      
      // Show updated user
      const updatedUser = await usersCollection.findOne({ phone });
      console.log('Обновленные данные:');
      console.log(`   Заблокирован: ${updatedUser.isBlocked ? '✅ ДА' : '❌ НЕТ'}`);
      console.log(`   Дата окончания: ${updatedUser.subscriptionEndDate ? new Date(updatedUser.subscriptionEndDate).toLocaleDateString('ru-RU') : 'не указана'}`);
      console.log();
      console.log('🎉 Готово! Пользователь может войти в систему.');
    } else {
      console.log('⚠️  Изменения не применены (возможно, данные уже актуальны)');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

// Run the script
unblockUser();
