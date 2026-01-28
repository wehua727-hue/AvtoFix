import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { findOneDocument, addDocument, updateDocument } from "../db/local-db";

export async function handleLogin(req: Request, res: Response) {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ 
        success: false, 
        error: "Telefon va parol majburiy" 
      });
    }

    // Local database dan foydalanuvchini qidirish
    const user = findOneDocument('users', { phone });
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: "Bu telefon raqami bilan hisob topilmadi" 
      });
    }

    // Parolni tekshirish
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: "Noto'g'ri telefon yoki parol" 
      });
    }

    // Token yaratish (simple JWT o'rniga base64)
    const token = Buffer.from(JSON.stringify({ 
      id: user._id, 
      phone: user.phone,
      role: user.role 
    })).toString('base64');

    return res.status(200).json({ 
      success: true, 
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        address: user.address,
        canEditProducts: user.canEditProducts,
      }
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return res.status(500).json({ 
      success: false, 
      error: "Kirishda xatolik" 
    });
  }
}

export async function handleRegister(req: Request, res: Response) {
  try {
    const { phone, password, name, role = 'xodim' } = req.body;

    if (!phone || !password || !name) {
      return res.status(400).json({ 
        success: false, 
        error: "Barcha maydonlar majburiy" 
      });
    }

    // Foydalanuvchi allaqachon mavjudligini tekshirish
    const existingUser = findOneDocument('users', { phone });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: "Bu telefon raqami bilan hisob allaqachon mavjud" 
      });
    }

    // Parolni hashlash
    const hashedPassword = await bcrypt.hash(password, 10);

    // Yangi foydalanuvchi yaratish
    const newUser = addDocument('users', {
      phone,
      password: hashedPassword,
      name,
      role,
      address: '',
      createdAt: new Date(),
    });

    const token = Buffer.from(JSON.stringify({ 
      id: newUser._id, 
      phone: newUser.phone,
      role: newUser.role 
    })).toString('base64');

    return res.status(201).json({ 
      success: true, 
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        phone: newUser.phone,
        role: newUser.role,
      }
    });
  } catch (error) {
    console.error('[Auth] Register error:', error);
    return res.status(500).json({ 
      success: false, 
      error: "Ro'yxatdan o'tishda xatolik" 
    });
  }
}
