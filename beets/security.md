# 🔐 SECURITY - Xavfsizlik

## 📋 Umumiy Ma'lumot

**Fayllar:**
- `server/middleware/auth.ts`
- `server/middleware/sku-validation.ts`

---

## 🛡️ Xavfsizlik Choralari

### 1. Authentication (Autentifikatsiya)
- JWT token
- Password hashing (bcrypt)
- Session management

### 2. Authorization (Avtorizatsiya)
- Rol-based access control
- Permission checking
- User isolation

### 3. Input Validation
- Zod schema validation
- SQL injection prevention
- XSS prevention

### 4. CORS
- Allowed origins
- Credentials support
- Preflight requests

### 5. Rate Limiting
- API request limiting
- Brute force protection

---

## 🔑 Password Security

### Hashing:
```typescript
import bcrypt from 'bcryptjs';

// Hash
const hash = await bcrypt.hash(password, 10);

// Verify
const valid = await bcrypt.compare(password, hash);
```

### Requirements:
- Minimum 6 characters
- Mix of letters and numbers (recommended)

---

## 🔒 JWT Token

### Token Structure:
```typescript
{
  userId: "...",
  role: "ega",
  iat: 1707566400,
  exp: 1707652800
}
```

### Token Verification:
```typescript
const decoded = jwt.verify(token, JWT_SECRET);
```

---

## 🚫 Input Validation

### Zod Schema:
```typescript
const productSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(50),
  price: z.number().positive(),
  stock: z.number().int().min(0),
});
```

---

## 🌐 CORS Configuration

```typescript
const corsOptions = {
  origin: ['https://shop.avtofix.uz'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
};
```

---

## 📊 Security Best Practices

1. ✅ Always use HTTPS in production
2. ✅ Never expose sensitive data in logs
3. ✅ Validate all user inputs
4. ✅ Use parameterized queries
5. ✅ Keep dependencies updated
6. ✅ Implement rate limiting
7. ✅ Use secure session management
8. ✅ Regular security audits

---

**Yaratilgan:** 2025-02-10
