# 🔐 AUTHENTICATION - Autentifikatsiya va Avtorizatsiya

## 📋 Umumiy Ma'lumot

**Fayllar:**
- `server/routes/auth.ts` - Auth API
- `client/lib/auth-context.tsx` - Auth Context
- `server/middleware/auth.ts` - Auth Middleware

**Texnologiya:** JWT, bcrypt

---

## 🎯 Asosiy Funksiyalar

### 1. Login (Kirish)
```typescript
POST /api/auth/login
{
  "phone": "914058481",
  "password": "1234567"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "...",
    "name": "Javohir",
    "role": "ega"
  }
}
```

### 2. Token Verification
```typescript
POST /api/auth/verify
Headers: { Authorization: "Bearer <token>" }

Response:
{
  "valid": true,
  "user": { ... }
}
```

### 3. Login As (Admin uchun)
```typescript
POST /api/auth/login-as
{
  "targetUserId": "..."
}
```

---

## 🔑 JWT Token

### Token Tuzilmasi:
```typescript
{
  userId: "...",
  role: "ega",
  iat: 1707566400,
  exp: 1707652800
}
```

### Token Yaratish:
```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { userId: user._id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);
```

### Token Tekshirish:
```typescript
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

---

## 👥 Rol Tizimi

### Rollar:
1. **Ega** - Barcha huquqlar
2. **Admin** - Ko'p huquqlar
3. **Menejer** - Mahsulot boshqarish
4. **Kassir** - Faqat savdo

### Huquqlar:
```typescript
const permissions = {
  ega: ['*'],
  admin: ['users', 'products', 'sales', 'reports'],
  menejer: ['products', 'categories', 'sales'],
  kassir: ['sales'],
};
```

---

## 🔒 Password Hashing

### Hash:
```typescript
import bcrypt from 'bcryptjs';

const hashedPassword = await bcrypt.hash(password, 10);
```

### Verify:
```typescript
const isValid = await bcrypt.compare(password, user.password);
```

---

**Yaratilgan:** 2025-02-10
