/**
 * Birthday checker - continuously checks and sends birthday notifications via Telegram
 */

import { connectMongo } from './mongo';
import { sendBirthdayNotification } from './telegram-bot';

// Track which notifications were sent today to avoid duplicates
const sentNotifications = new Map<string, string>(); // customerId -> date

/**
 * Check for birthdays today and send Telegram notifications
 */
export async function checkBirthdaysAndNotify() {
  try {
    console.log('[Birthday Checker] Checking birthdays...');
    
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

    // Get all customers
    const customers = await customersCollection.find({}).toArray();

    let notificationsSent = 0;
    let notificationsFailed = 0;

    const todayStr = `${today.getFullYear()}-${todayMonth}-${todayDay}`;
    
    // Clear old notifications from previous days
    for (const [key, date] of sentNotifications.entries()) {
      if (date !== todayStr) {
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
        const notificationKey = `${customer._id}-${customer.userId}`;
        
        // Skip if already sent today
        if (sentNotifications.get(notificationKey) === todayStr) {
          continue;
        }

        // Find the user who created this customer
        const user = await usersCollection.findOne({ _id: customer.userId });

        if (user && user.telegramChatId) {
          console.log('[Birthday Checker] Birthday today:', customer.firstName, customer.lastName);
          
          // Send Telegram notification
          const success = await sendBirthdayNotification(
            user.telegramChatId,
            `${customer.firstName} ${customer.lastName}`,
            customer.phone
          );

          if (success) {
            notificationsSent++;
            sentNotifications.set(notificationKey, todayStr);
          } else {
            notificationsFailed++;
          }
        }
      }
    }

    console.log(
      `[Birthday Checker] Completed. Sent: ${notificationsSent}, Failed: ${notificationsFailed}`
    );
  } catch (error) {
    console.error('[Birthday Checker] Error:', error);
  }
}

/**
 * Start birthday checker (runs every minute)
 */
export function startBirthdayChecker() {
  console.log('[Birthday Checker] Starting continuous checker (every 1 minute)');
  
  // Run immediately on startup
  checkBirthdaysAndNotify();
  
  // Then run every minute
  setInterval(checkBirthdaysAndNotify, 60 * 1000);
}
