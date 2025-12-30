import TelegramBot from 'node-telegram-bot-api';
import { connectMongo } from './mongo';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8283418093:AAEazrxdFKrR3XTsgxwSmnazr4PUjDTutzk';

let bot: TelegramBot | null = null;

/**
 * Initialize Telegram bot
 */
export function initTelegramBot() {
  if (!BOT_TOKEN) {
    console.warn('[Telegram Bot] No bot token provided');
    return null;
  }

  try {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });

    // Handle /start command with optional user ID parameter
    bot.onText(/\/start(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username || msg.from?.first_name || 'Foydalanuvchi';
      const startParam = match?.[1]?.trim(); // Get parameter after /start

      console.log('[Telegram Bot] /start command from:', username, 'chatId:', chatId, 'param:', startParam);

      // If start parameter contains userId, automatically link account
      if (startParam) {
        try {
          const conn = await connectMongo();
          if (!conn?.db) {
            await bot?.sendMessage(chatId, 'Xatolik yuz berdi. Keyinroq qayta urinib ko\'ring.');
            return;
          }

          const db = conn.db;
          const usersCollection = db.collection('users');

          // Find user by ID
          const mongoose = await import('mongoose');
          const userId = new mongoose.Types.ObjectId(startParam);
          const user = await usersCollection.findOne({ _id: userId });

          if (user) {
            // Update user with telegram chatId
            await usersCollection.updateOne(
              { _id: userId },
              { $set: { telegramChatId: chatId.toString() } }
            );

            await bot?.sendMessage(
              chatId,
              `✅ Muvaffaqiyatli bog'landi!\n\n` +
              `Salom, ${user.name || username}! 👋\n\n` +
              `Endi siz quyidagi xabarlarni olasiz:\n` +
              `🎂 Mijozlarning tug'ilgan kunlari\n` +
              `💰 Qarzlarni qaytarish eslatmalari\n\n` +
              `Saytga qaytishingiz mumkin!`
            );

            console.log('[Telegram Bot] User auto-linked:', startParam, 'chatId:', chatId);
            return;
          } else {
            console.log('[Telegram Bot] User not found with ID:', startParam);
          }
        } catch (error) {
          console.error('[Telegram Bot] Error auto-linking user:', error);
        }
      }

      // If no parameter or user not found, ask for phone number
      await bot?.sendMessage(
        chatId,
        `Assalomu alaykum, ${username}! 👋\n\n` +
        `Tug'ilgan kun va qarz eslatmalarini olish uchun, iltimos telefon raqamingizni yuboring.\n\n` +
        `Masalan: +998901234567`
      );
    });

    // Handle phone number
    bot.on('message', async (msg) => {
      if (msg.text?.startsWith('/')) return; // Skip commands

      const chatId = msg.chat.id;
      const text = msg.text || '';

      // Check if it's a phone number
      const phoneRegex = /^\+?998\d{9}$/;
      if (phoneRegex.test(text.replace(/\s/g, ''))) {
        const phone = text.replace(/\s/g, '');
        
        try {
          const conn = await connectMongo();
          if (!conn?.db) {
            await bot?.sendMessage(chatId, 'Xatolik yuz berdi. Keyinroq qayta urinib ko\'ring.');
            return;
          }

          const db = conn.db;
          const usersCollection = db.collection('users');

          // Find user by phone
          const user = await usersCollection.findOne({ phone });

          if (user) {
            // Update user with telegram chatId
            await usersCollection.updateOne(
              { phone },
              { $set: { telegramChatId: chatId } }
            );

            await bot?.sendMessage(
              chatId,
              `✅ Muvaffaqiyatli bog'landi!\n\n` +
              `Endi mijozlaringizning tug'ilgan kunlari haqida xabar olasiz.`
            );

            console.log('[Telegram Bot] User linked:', phone, 'chatId:', chatId);
          } else {
            await bot?.sendMessage(
              chatId,
              `❌ Bu telefon raqami bilan foydalanuvchi topilmadi.\n\n` +
              `Iltimos, saytda ro'yxatdan o'tgan telefon raqamingizni kiriting.`
            );
          }
        } catch (error) {
          console.error('[Telegram Bot] Error linking user:', error);
          await bot?.sendMessage(chatId, 'Xatolik yuz berdi. Keyinroq qayta urinib ko\'ring.');
        }
      }
    });

    console.log('[Telegram Bot] Bot started successfully');
    return bot;
  } catch (error) {
    console.error('[Telegram Bot] Failed to start bot:', error);
    return null;
  }
}

/**
 * Send birthday notification to user's Telegram
 * @param timeMessage - Vaqtga qarab xabar (ertalab, tushlik, kechki)
 */
export async function sendBirthdayNotification(
  telegramChatId: string | number,
  customerName: string,
  customerPhone?: string,
  timeMessage?: string
) {
  if (!bot) {
    console.warn('[Telegram Bot] Bot not initialized');
    return false;
  }

  try {
    const header = timeMessage ? `${timeMessage}\n\n` : '';
    const message = 
      `🎉 Tug'ilgan kun eslatmasi!\n` +
      header +
      `Bugun mijozingiz ${customerName}ning tug'ilgan kuni.\n` +
      (customerPhone ? `📞 Telefon: ${customerPhone}\n\n` : '\n') +
      `Tabriklab qo'ying! 🎂`;

    await bot.sendMessage(telegramChatId, message);
    console.log('[Telegram Bot] Birthday notification sent to chatId:', telegramChatId);
    return true;
  } catch (error) {
    console.error('[Telegram Bot] Failed to send notification:', error);
    return false;
  }
}

/**
 * Send debt payment reminder to user's Telegram
 */
export async function sendDebtReminderNotification(
  telegramChatId: string | number,
  creditorName: string,
  amount: number,
  currency: string,
  dueDate: Date,
  creditorPhone?: string,
  countryCode?: string
) {
  if (!bot) {
    console.warn('[Telegram Bot] Bot not initialized');
    return false;
  }

  try {
    const dueDateStr = new Date(dueDate).toLocaleDateString('uz-UZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const formattedAmount = new Intl.NumberFormat('uz-UZ').format(amount);

    // Telefon raqamini to'liq formatda ko'rsatish (+998 bilan)
    let formattedPhone = '';
    if (creditorPhone) {
      const cleanPhone = creditorPhone.replace(/\D/g, ''); // Faqat raqamlar
      const code = countryCode || '+998';
      // Agar telefon raqami allaqachon kod bilan boshlansa, qayta qo'shmaslik
      if (cleanPhone.startsWith('998')) {
        formattedPhone = `+${cleanPhone}`;
      } else if (cleanPhone.startsWith('+')) {
        formattedPhone = cleanPhone;
      } else {
        formattedPhone = `${code}${cleanPhone}`;
      }
    }

    const message = 
      `💰 Qarz eslatmasi!\n\n` +
      `Ertaga ${creditorName}ga qarz qaytarish muddati tugaydi.\n\n` +
      `💵 Summa: ${formattedAmount} ${currency}\n` +
      `📅 Muddat: ${dueDateStr}\n` +
      (formattedPhone ? `📞 Telefon: ${formattedPhone}\n\n` : '\n') +
      `Iltimos, o'z vaqtida to'lang! ⏰`;

    await bot.sendMessage(telegramChatId, message);
    console.log('[Telegram Bot] Debt reminder sent to chatId:', telegramChatId);
    return true;
  } catch (error) {
    console.error('[Telegram Bot] Failed to send debt reminder:', error);
    return false;
  }
}

/**
 * Send subscription expiry notification to user's or owner's Telegram
 */
export async function sendSubscriptionExpiryNotification(
  telegramChatId: string | number,
  userName: string,
  expiryDate: Date,
  daysLeft: number,
  isOwner: boolean,
  userPhone?: string
) {
  if (!bot) {
    console.warn('[Telegram Bot] Bot not initialized');
    return false;
  }

  try {
    const expiryDateStr = new Date(expiryDate).toLocaleDateString('uz-UZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const supportPhone = process.env.SUPPORT_PHONE || '+998910712828';

    let message: string;

    if (isOwner) {
      // Message for owner/admin
      message = 
        `⚠️ Obuna tugash eslatmasi!\n\n` +
        `Foydalanuvchi: ${userName}\n` +
        (userPhone ? `📞 Telefon: ${userPhone}\n` : '') +
        `📅 Obuna tugash sanasi: ${expiryDateStr}\n` +
        `⏰ Qolgan vaqt: ertaga\n\n` +
        `Iltimos, foydalanuvchi bilan bog'laning va to'lovni eslatib o'ting.\n\n` +
        `📞 Aloqa: ${supportPhone}`;
    } else {
      // Message for user
      message = 
        `⚠️ Obuna tugash eslatmasi!\n\n` +
        `Hurmatli ${userName}!\n\n` +
        `Sizning obunangiz ertaga tugaydi.\n\n` +
        `📅 Tugash sanasi: ${expiryDateStr}\n\n` +
        `Xizmatdan uzluksiz foydalanish uchun, iltimos to'lovni amalga oshiring.\n\n` +
        `📞 Aloqa uchun: ${supportPhone}\n` +
        `💳 To'lov qilish uchun administrator bilan bog'laning.`;
    }

    await bot.sendMessage(telegramChatId, message);
    console.log('[Telegram Bot] Subscription expiry notification sent to chatId:', telegramChatId, 'isOwner:', isOwner);
    return true;
  } catch (error) {
    console.error('[Telegram Bot] Failed to send subscription expiry notification:', error);
    return false;
  }
}

/**
 * Get bot instance
 */
export function getTelegramBot() {
  return bot;
}
