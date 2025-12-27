/**
 * Test script for subscription expiry notifications
 * Shows users with expiring subscriptions and tests notification sending
 */

import 'dotenv/config';
import { connectMongo } from '../mongo';
import { initTelegramBot, sendSubscriptionExpiryNotification } from '../telegram-bot';

async function testSubscriptionNotifications() {
  console.log('='.repeat(60));
  console.log('ТЕСТИРОВАНИЕ УВЕДОМЛЕНИЙ О ПОДПИСКАХ');
  console.log('='.repeat(60));
  console.log();

  try {
    // Connect to MongoDB
    console.log('[1/5] Подключение к MongoDB...');
    const conn = await connectMongo();
    if (!conn?.db) {
      console.error('❌ Не удалось подключиться к базе данных');
      process.exit(1);
    }
    console.log('✅ Подключено к MongoDB');
    console.log();

    const db = conn.db;
    const usersCollection = db.collection('users');

    // Initialize Telegram bot
    console.log('[2/5] Инициализация Telegram бота...');
    const bot = initTelegramBot();
    if (!bot) {
      console.error('❌ Не удалось инициализировать Telegram бота');
      console.log('Проверьте переменную окружения TELEGRAM_BOT_TOKEN');
      process.exit(1);
    }
    console.log('✅ Telegram бот инициализирован');
    console.log();

    // Calculate date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    console.log('[3/5] Поиск пользователей с истекающими подписками...');
    console.log(`Дата проверки: ${tomorrow.toLocaleDateString('ru-RU')}`);
    console.log();

    // Find users with expiring subscriptions
    const users = await usersCollection.find({
      subscriptionType: 'oddiy',
      isBlocked: { $ne: true },
      subscriptionEndDate: {
        $gte: tomorrow,
        $lt: dayAfterTomorrow,
      },
    }).toArray();

    console.log(`Найдено пользователей: ${users.length}`);
    console.log();

    if (users.length === 0) {
      console.log('ℹ️  Нет пользователей с подписками, истекающими завтра');
      console.log();
      console.log('Для тестирования можно:');
      console.log('1. Создать тестового пользователя с subscriptionType="oddiy"');
      console.log('2. Установить subscriptionEndDate на завтрашнюю дату');
      console.log('3. Подключить Telegram через бота');
      console.log();
      
      // Show all users with "oddiy" subscription
      const allOddiyUsers = await usersCollection.find({
        subscriptionType: 'oddiy',
      }).toArray();
      
      if (allOddiyUsers.length > 0) {
        console.log(`Всего пользователей с тарифом "oddiy": ${allOddiyUsers.length}`);
        console.log();
        allOddiyUsers.forEach((u, i) => {
          const endDate = u.subscriptionEndDate ? new Date(u.subscriptionEndDate) : null;
          const daysLeft = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
          
          console.log(`${i + 1}. ${u.name}`);
          console.log(`   Телефон: ${u.phone}`);
          console.log(`   Дата окончания: ${endDate ? endDate.toLocaleDateString('ru-RU') : 'не указана'}`);
          console.log(`   Дней до окончания: ${daysLeft !== null ? daysLeft : 'н/д'}`);
          console.log(`   Telegram: ${u.telegramChatId ? '✅ подключен' : '❌ не подключен'}`);
          console.log(`   Заблокирован: ${u.isBlocked ? '✅ да' : '❌ нет'}`);
          console.log();
        });
      }
      
      process.exit(0);
    }

    // Display found users
    console.log('[4/5] Информация о пользователях:');
    console.log('-'.repeat(60));
    users.forEach((u, i) => {
      const endDate = new Date(u.subscriptionEndDate);
      const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`${i + 1}. ${u.name}`);
      console.log(`   Телефон: ${u.phone}`);
      console.log(`   Дата окончания: ${endDate.toLocaleDateString('ru-RU')}`);
      console.log(`   Дней до окончания: ${daysLeft}`);
      console.log(`   Telegram: ${u.telegramChatId ? '✅ подключен (chatId: ' + u.telegramChatId + ')' : '❌ не подключен'}`);
      console.log();
    });
    console.log('-'.repeat(60));
    console.log();

    // Find owner/admin
    const owner = await usersCollection.findOne({
      role: { $in: ['egasi', 'admin'] },
      telegramChatId: { $exists: true, $ne: null },
    });

    if (owner) {
      console.log('Владелец/администратор для уведомлений:');
      console.log(`   Имя: ${owner.name}`);
      console.log(`   Роль: ${owner.role}`);
      console.log(`   Telegram chatId: ${owner.telegramChatId}`);
      console.log();
    } else {
      console.log('⚠️  Владелец/администратор с Telegram не найден');
      console.log();
    }

    // Ask for confirmation
    console.log('[5/5] Отправка тестовых уведомлений...');
    console.log();
    console.log('⚠️  ВНИМАНИЕ: Сейчас будут отправлены реальные уведомления в Telegram!');
    console.log();

    // Wait 3 seconds before sending
    console.log('Отправка через 3 секунды...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    let userNotificationsSent = 0;
    let ownerNotificationsSent = 0;
    let notificationsFailed = 0;

    for (const user of users) {
      const endDate = new Date(user.subscriptionEndDate);
      const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`Обработка пользователя: ${user.name}`);

      // Send to user
      if (user.telegramChatId) {
        console.log('  → Отправка уведомления пользователю...');
        const success = await sendSubscriptionExpiryNotification(
          user.telegramChatId,
          user.name,
          user.subscriptionEndDate,
          daysLeft,
          false,
          user.phone
        );

        if (success) {
          userNotificationsSent++;
          console.log('  ✅ Уведомление пользователю отправлено');
        } else {
          notificationsFailed++;
          console.log('  ❌ Не удалось отправить уведомление пользователю');
        }
      } else {
        console.log('  ⚠️  У пользователя нет Telegram');
      }

      // Send to owner
      if (owner && owner.telegramChatId) {
        console.log('  → Отправка уведомления владельцу...');
        const success = await sendSubscriptionExpiryNotification(
          owner.telegramChatId,
          user.name,
          user.subscriptionEndDate,
          daysLeft,
          true,
          user.phone
        );

        if (success) {
          ownerNotificationsSent++;
          console.log('  ✅ Уведомление владельцу отправлено');
        } else {
          notificationsFailed++;
          console.log('  ❌ Не удалось отправить уведомление владельцу');
        }
      }

      console.log();
    }

    console.log('='.repeat(60));
    console.log('РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ');
    console.log('='.repeat(60));
    console.log(`Уведомлений пользователям: ${userNotificationsSent}`);
    console.log(`Уведомлений владельцу: ${ownerNotificationsSent}`);
    console.log(`Ошибок: ${notificationsFailed}`);
    console.log('='.repeat(60));
    console.log();

    if (userNotificationsSent > 0 || ownerNotificationsSent > 0) {
      console.log('✅ Тестирование завершено успешно!');
      console.log('Проверьте Telegram для просмотра уведомлений.');
    } else {
      console.log('⚠️  Уведомления не были отправлены.');
      console.log('Проверьте подключение Telegram у пользователей.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
    process.exit(1);
  }
}

// Run the test
testSubscriptionNotifications();
