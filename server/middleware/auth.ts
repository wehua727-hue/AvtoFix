import { Request, Response, NextFunction } from 'express';

// Request'ga userId qo'shish uchun
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// userId ni header yoki body dan olish
export function extractUserId(req: Request, res: Response, next: NextFunction) {
  // Header dan olish (masalan: x-user-id)
  const userIdFromHeader = req.headers['x-user-id'] as string;
  
  // Body dan olish (agar header bo'lmasa)
  const userIdFromBody = req.body?.userId;
  
  // Query dan olish
  const userIdFromQuery = req.query?.userId as string;
  
  req.userId = userIdFromHeader || userIdFromBody || userIdFromQuery;
  
  next();
}
