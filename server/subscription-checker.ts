/**
 * Subscription checker - continuously checks and sends subscription expiry notifications via Telegram
 * Sends notification 1 day before account blocking
 */

import mongoose from 'mongoose';
import { connectMongo } from './mongo';
import { sendSubscriptionExpiryNotification } from './telegram-bot';

const { ObjectId } = mongoose.Types;

// Track which notifications were sent today to avoid duplicates
const sentSubscriptionNotifications = new Map<string, string>(); // userId -> date

/**
 * Check for subscriptions expiring tomorrow and send Telegram notifications
 */
export async function checkSubscriptionsAndNotify() {
  try {
    console.log('[Subscription Checker] Checking subscriptions...');
    
    const conn = await connectMongo();
    if (!conn?.db) {
      console.error('[Subscription Checker] Database not available');
      return;
    }

    const db = conn.db;
    const usersCollection = db.collection('users');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate tomorrow's date range
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    dayAfterTomorrow.setHours(0, 0, 0, 0);

    console.log('[Subscription Checker] Looking for subscriptions expiring on:', tomorrow.toLocaleDateString('uz-UZ'));
    console.log('[Subscription Checker] Date range:', { 
      from: tomorrow.toISOString(), 
      to: dayAfterTomorrow.toISOString() 
    });

    // Find users with "oddiy" subscription expiring tomorrow and not yet blocked
    const users = await usersCollection.find({
      subscriptionType: 'oddiy',
      isBlocked: { $ne: true },
      subscriptionEndDate: {
        $gte: tomorrow,
        $lt: dayAfterTomorrow,
      },
    }).toArray();
    
    console.log('[Subscription Checker] Found users with expiring subscriptions:', users.length);
    
    if (users.length > 0) {
      users.forEach((u, i) => {
        console.log(`[Subscription Checker] User ${i + 1}:`, {
          name: u.name,
          phone: u.phone,
          subscriptionEndDate: u.subscriptionEndDate,
          hasTelegramChatId: !!u.telegramChatId,
        });
      });
    }

    const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    
    // Clear old notifications from previous days
    for (const [key, date] of sentSubscriptionNotifications.entries()) {
      if (date !== todayStr) {
        sentSubscriptionNotifications.delete(key);
      }
    }

    let userNotificationsSent = 0;
    let ownerNotificationsSent = 0;
    let notificationsFailed = 0;

    // Find owner/admin for notifications
    const owner = await usersCollection.findOne({
      role: { $in: ['egasi', 'admin'] },
      telegramChatId: { $exists: true, $ne: null },
    });

    if (!owner || !owner.telegramChatId) {
      console.warn('[Subscription Checker] No owner/admin with Telegram found for notifications');
    }

    for (const user of users) {
      const notificationKey = `${user._id}`;
      
      // Skip if already sent today
      if (sentSubscriptionNotifications.get(notificationKey) === todayStr) {
        console.log('[Subscription Checker] Notification already sent today for user:', user.name);
        continue;
      }

      // Calculate days left (should be 1)
      const endDate = new Date(user.subscriptionEndDate);
      const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      console.log('[Subscription Checker] Processing user:', {
        name: user.name,
        phone: user.phone,
        daysLeft,
        hasTelegramChatId: !!user.telegramChatId,
      });

      let userNotificationSuccess = false;
      let ownerNotificationSuccess = false;

      // Send notification to user if they have Telegram connected
      if (user.telegramChatId) {
        console.log('[Subscription Checker] Sending notification to user:', user.name);
        
        userNotificationSuccess = await sendSubscriptionExpiryNotification(
          user.telegramChatId,
          user.name,
          user.subscriptionEndDate,
          daysLeft,
          false, // isOwner = false
          user.phone
        );

        if (userNotificationSuccess) {
          userNotificationsSent++;
          console.log('[Subscription Checker] ✓ User notification sent to:', user.name);
        } else {
          notificationsFailed++;
          console.log('[Subscription Checker] ✗ Failed to send user notification to:', user.name);
        }
      } else {
        console.log('[Subscription Checker] User has no Telegram connected:', user.name);
      }

      // Send notification to owner/admin
      if (owner && owner.telegramChatId) {
        console.log('[Subscription Checker] Sending notification to owner about user:', user.name);
        
        ownerNotificationSuccess = await sendSubscriptionExpiryNotification(
          owner.telegramChatId,
          user.name,
          user.subscriptionEndDate,
          daysLeft,
          true, // isOwner = true
          user.phone
        );

        if (ownerNotificationSuccess) {
          ownerNotificationsSent++;
          console.log('[Subscription Checker] ✓ Owner notification sent for user:', user.name);
        } else {
          notificationsFailed++;
          console.log('[Subscription Checker] ✗ Failed to send owner notification for user:', user.name);
        }
      }

      // Mark as sent if at least one notification was successful
      if (userNotificationSuccess || ownerNotificationSuccess) {
        sentSubscriptionNotifications.set(notificationKey, todayStr);
      }
    }

    console.log(
      `[Subscription Checker] Completed. User notifications: ${userNotificationsSent}, Owner notifications: ${ownerNotificationsSent}, Failed: ${notificationsFailed}`
    );
  } catch (error) {
    console.error('[Subscription Checker] Error:', error);
  }
}

/**
 * Start subscription checker (runs every minute)
 */
export function startSubscriptionChecker() {
  console.log('[Subscription Checker] Starting continuous checker (every 1 minute)');
  
  // Run immediately on startup
  checkSubscriptionsAndNotify();
  
  // Then run every minute
  setInterval(checkSubscriptionsAndNotify, 60 * 1000);
}
