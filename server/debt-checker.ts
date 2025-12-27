/**
 * Debt checker - continuously checks and sends debt payment reminders via Telegram
 * Sends notification 1 day before due date
 */

import mongoose from 'mongoose';
import { connectMongo } from './mongo';
import { sendDebtReminderNotification } from './telegram-bot';

const { ObjectId } = mongoose.Types;

// Track which notifications were sent today to avoid duplicates
const sentDebtNotifications = new Map<string, string>(); // debtId -> date

/**
 * Check for debts due tomorrow and send Telegram notifications
 */
export async function checkDebtsAndNotify() {
  try {
    console.log('[Debt Checker] Checking debts...');
    
    const conn = await connectMongo();
    if (!conn?.db) {
      console.error('[Debt Checker] Database not available');
      return;
    }

    const db = conn.db;
    const debtsCollection = db.collection('debts');
    const usersCollection = db.collection('users');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate tomorrow's date
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    console.log('[Debt Checker] Looking for debts due on:', tomorrow.toLocaleDateString('uz-UZ'));
    console.log('[Debt Checker] Date range:', { from: tomorrow.toISOString(), to: dayAfterTomorrow.toISOString() });

    // Find debts that are due tomorrow and not yet paid
    const debts = await debtsCollection.find({
      status: { $in: ['pending', 'overdue'] },
      dueDate: {
        $gte: tomorrow,
        $lt: dayAfterTomorrow,
      },
    }).toArray();
    
    console.log('[Debt Checker] Found debts due tomorrow:', debts.length);
    if (debts.length > 0) {
      debts.forEach((d, i) => {
        console.log(`[Debt Checker] Debt ${i + 1}:`, {
          creditor: d.creditor,
          amount: d.amount,
          dueDate: d.dueDate,
          userId: d.userId,
          status: d.status,
        });
      });
    }

    const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    
    // Clear old notifications from previous days
    for (const [key, date] of sentDebtNotifications.entries()) {
      if (date !== todayStr) {
        sentDebtNotifications.delete(key);
      }
    }

    let notificationsSent = 0;
    let notificationsFailed = 0;

    for (const debt of debts) {
      const notificationKey = `${debt._id}-${debt.userId}`;
      
      // Skip if already sent today
      if (sentDebtNotifications.get(notificationKey) === todayStr) {
        continue;
      }

      // Find the user who created this debt
      // userId can be string or ObjectId, try both
      let user = null;
      if (debt.userId) {
        const userIdStr = String(debt.userId);
        // Try as ObjectId first
        if (ObjectId.isValid(userIdStr)) {
          user = await usersCollection.findOne({ _id: new ObjectId(userIdStr) } as any);
        }
        // If not found, try as string
        if (!user) {
          user = await usersCollection.findOne({ _id: userIdStr } as any);
        }
        // Also try by id field (some users might have string id)
        if (!user) {
          user = await usersCollection.findOne({ id: userIdStr });
        }
      }
      
      console.log('[Debt Checker] User lookup:', {
        debtUserId: debt.userId,
        userFound: !!user,
        hasTelegramChatId: user?.telegramChatId ? 'yes' : 'no',
      });

      if (user && user.telegramChatId) {
        console.log('[Debt Checker] Processing debt:', {
          creditor: debt.creditor,
          amount: debt.amount,
          dueDate: debt.dueDate,
        });
        
        // Send Telegram notification
        const success = await sendDebtReminderNotification(
          user.telegramChatId,
          debt.creditor,
          debt.amount,
          debt.currency || 'UZS',
          debt.dueDate,
          debt.phone,
          debt.countryCode || '+998'
        );

        if (success) {
          notificationsSent++;
          sentDebtNotifications.set(notificationKey, todayStr);
          console.log('[Debt Checker] ✓ Notification sent for debt:', debt.creditor);
        } else {
          notificationsFailed++;
          console.log('[Debt Checker] ✗ Failed to send notification for debt:', debt.creditor);
        }
      }
    }

    console.log(
      `[Debt Checker] Completed. Sent: ${notificationsSent}, Failed: ${notificationsFailed}`
    );
  } catch (error) {
    console.error('[Debt Checker] Error:', error);
  }
}

/**
 * Start debt checker (runs every minute)
 */
export function startDebtChecker() {
  console.log('[Debt Checker] Starting continuous checker (every 1 minute)');
  
  // Run immediately on startup
  checkDebtsAndNotify();
  
  // Then run every minute
  setInterval(checkDebtsAndNotify, 60 * 1000);
}
