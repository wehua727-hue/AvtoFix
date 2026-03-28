import { RequestHandler } from "express";
import { connectMongo } from "../mongo";

/**
 * Middleware для проверки статуса подписки пользователя
 * Блокирует доступ если подписка истекла
 */
export const checkSubscription: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.body?.userId || req.query?.userId;
    
    if (!userId) {
      return next();
    }

    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return next();
    }

    const db = conn.db;
    const user = await db.collection("users").findOne({ _id: userId });

    if (!user) {
      return next();
    }

    // Проверяем тип подписки
    if (user.subscriptionType === "cheksiz") {
      // Безлимитная подписка - всегда разрешаем доступ
      return next();
    }

    // Для обычной подписки проверяем дату окончания
    if (user.subscriptionType === "oddiy" && user.subscriptionEndDate) {
      const now = new Date();
      const endDate = new Date(user.subscriptionEndDate);
      
      if (now > endDate) {
        // Подписка истекла - блокируем пользователя
        await db.collection("users").updateOne(
          { _id: userId },
          { $set: { isBlocked: true } }
        );
        
        return res.status(403).json({
          error: "subscription_expired",
          message: "Obuna muddati tugagan. Iltimos, +998910712828 raqamiga qo'ng'iroq qiling.",
          phone: "+998910712828"
        });
      } else if (user.isBlocked) {
        // Подписка продлена, но пользователь все еще заблокирован - разблокируем
        await db.collection("users").updateOne(
          { _id: userId },
          { $set: { isBlocked: false } }
        );
        console.log(`[checkSubscription] Auto-unblocked user ${userId} - subscription extended`);
      }
    }

    // Проверяем флаг блокировки
    if (user.isBlocked) {
      return res.status(403).json({
        error: "account_blocked",
        message: "Akkaunt bloklangan. Iltimos, +998910712828 raqamiga qo'ng'iroq qiling.",
        phone: "+998910712828"
      });
    }

    next();
  } catch (error) {
    console.error("[checkSubscription] Error:", error);
    next();
  }
};
