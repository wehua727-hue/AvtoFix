/**
 * Birthday checker - sends birthday notifications via Telegram at 06:00, 12:00, 18:00
 */

import { connectMongo } from './mongo';
import { sendBirthdayNotification } from './telegram-bot';

// Eslatma vaqtlari (soat)
const NOTIFICATION_HOURS = [6, 12, 18];

// Track which notifications were sent today to avoid duplicates
// Format: customerId-userId-hour -> date
const sentNotifications = new Map<string, string>();

/**
 * Hozirgi soat eslatma vaqtiga to'g'ri keladimi tekshirish
 */
function isNotificationTime(): { isTime: boolean; hour: number } {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Faqat belgilangan soatlarda va daqiqa 0-5 oralig'ida ishlaydi
  if (NOTIFICATION_HOURS.includes(currentHour) && currentMinute < 5) {
    return { isTime: true, hour: currentHour };
  }
  
  return { isTime: false, hour: currentHour };
}

/**
 * Check for birthdays today and send Telegram notifications
 */
export async function checkBirthdaysAndNotify() {
  try {
    const { isTime, hour } = isNotificationTime();
    
    // Agar eslatma vaqti bo'lmasa, chiqib ketish
    if (!isTime) {
      return;
    }
    
    console.log(`[Birthday Checker] Checking birthdays at ${hour}:00...`);
    
    const conn = await connectMongo();
    if (!conn?.db) {
      console.error('[Birthday Checker] Database not available');
      return;
    }

    const db = conn.db;
    const customersCollection = db.collection('customers');
    const usersCollection = db.collection('users');

    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const todayStr = `${today.getFullYear()}-${todayMonth}-${todayDay}`;

    // Get all customers
    const customers = await customersCollection.find({}).toArray();

    let notificationsSent = 0;
    let notificationsFailed = 0;

    // Clear old notifications from previous days
    for (const [key, date] of sentNotifications.entries()) {
      if (!date.startsWith(todayStr)) {
        sentNotifications.delete(key);
      }
    }

    for (const customer of customers) {
      if (!customer.birthDate) continue;
      
      const birthDate = new Date(customer.birthDate);
      const birthMonth = birthDate.getMonth() + 1;
      const birthDay = birthDate.getDate();

      // Check if birthday is today
      if (birthMonth === todayMonth && birthDay === todayDay) {
        // Har bir soat uchun alohida kalit
        const notificationKey = `${customer._id}-${customer.userId}-${hour}`;
        const notificationValue = `${todayStr}-${hour}`;
        
        // Skip if already sent at this hour today
        if (sentNotifications.get(notificationKey) === notificationValue) {
          continue;
        }

        // Find the user who created this customer
        const user = await usersCollection.findOne({ _id: customer.userId });

        if (user && user.telegramChatId) {
          // Soatga qarab xabar matni
          let timeMessage = '';
          if (hour === 6) {
            timeMessage = '🌅 Ertalabki eslatma';
          } else if (hour === 12) {
            timeMessage = '☀️ Tushlik vaqti eslatmasi';
          } else if (hour === 18) {
            timeMessage = '🌆 Kechki eslatma';
          }
          
          console.log(`[Birthday Checker] ${timeMessage}: ${customer.firstName} ${customer.lastName}`);
          
          // Send Telegram notification
          const success = await sendBirthdayNotification(
            user.telegramChatId,
            `${customer.firstName} ${customer.lastName}`,
            customer.phone,
            timeMessage
          );

          if (success) {
            notificationsSent++;
            sentNotifications.set(notificationKey, notificationValue);
          } else {
            notificationsFailed++;
          }
        }
      }
    }

    if (notificationsSent > 0 || notificationsFailed > 0) {
      console.log(
        `[Birthday Checker] ${hour}:00 completed. Sent: ${notificationsSent}, Failed: ${notificationsFailed}`
      );
    }
  } catch (error) {
    console.error('[Birthday Checker] Error:', error);
  }
}

/**
 * Start birthday checker (runs every minute to check if it's notification time)
 */
export function startBirthdayChecker() {
  console.log('[Birthday Checker] Starting... Notifications at 06:00, 12:00, 18:00');
  
  // Run immediately on startup (for testing)
  checkBirthdaysAndNotify();
  
  // Then run every minute to check if it's notification time
  setInterval(checkBirthdaysAndNotify, 60 * 1000);
}
