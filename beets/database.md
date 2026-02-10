# 🗄️ DATABASE (Ma'lumotlar Bazasi) - Batafsil Hujjat

## 📋 Umumiy Ma'lumot

**Texnologiya:** MongoDB 7, Mongoose 8

**Fayl:** `server/mongo.ts`

**Connection String:** `mongodb://localhost:27017/avtofix` yoki MongoDB Atlas

---

## 📊 Collections (Jadvallar)

### 1. **users** - Foydalanuvchilar

```typescript
interface User {
  _id: ObjectId;
  phone: string;              // Telefon raqami (unique)
  password: string;           // Hashed password (bcrypt)
  name: string;               // Ism
  role: UserRole;             // Rol
  branchId?: string;          // Filial ID
  isActive: boolean;          // Faolmi?
  isBlocked: boolean;         // Bloklangan mi?
  subscriptionEndDate?: Date; // Obuna tugash sanasi
  createdAt: Date;
  updatedAt: Date;
}

type UserRole = 'ega' | 'admin' | 'menejer' | 'kassir';
```

**Indexes:**
- `phone` (unique)
- `role`
- `isActive`

---

### 2. **products** - Mahsulotlar

```typescript
interface Product {
  _id: ObjectId;
  name: string;
  sku: string;                // Mahsulot kodi (unique per user)
  catalogNumber?: string;
  price: number;
  basePrice?: number;
  priceMultiplier?: number;
  currency: Currency;
  stock: number;
  categoryId?: ObjectId;
  userId: ObjectId;           // Egasi
  branchId?: ObjectId;        // Filial
  imageUrl?: string;
  imagePaths?: string[];
  status: ProductStatus;
  variants?: ProductVariant[];
  variantSummaries?: VariantSummary[];
  parentProductId?: ObjectId;
  childProducts?: ChildProduct[];
  isHidden?: boolean;
  description?: string;
  video?: VideoInfo;
  source?: string;            // 'excel-import' | 'manual'
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `sku, userId` (compound unique)
- `userId`
- `categoryId`
- `status`
- `name` (text index for search)

---

### 3. **categories** - Kategoriyalar

```typescript
interface Category {
  _id: ObjectId;
  name: string;
  parentId?: ObjectId;        // Ota kategoriya
  userId: ObjectId;
  level: number;              // Daraja (0 = root)
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `userId`
- `parentId`

---

### 4. **stores** - Do'konlar/Filiallar

```typescript
interface Store {
  _id: ObjectId;
  name: string;
  address?: string;
  phone?: string;
  userId: ObjectId;           // Egasi
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `userId`

---

### 5. **customers** - Mijozlar

```typescript
interface Customer {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate: Date;
  notes?: string;
  userId: ObjectId;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `userId`
- `phone`
- `birthDate`

---

### 6. **orders** - Buyurtmalar

```typescript
interface Order {
  _id: ObjectId;
  customerId: ObjectId;
  userId: ObjectId;
  items: OrderItem[];
  total: number;
  paymentType: PaymentType;
  status: OrderStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface OrderItem {
  productId: ObjectId;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  currency: Currency;
}
```

**Indexes:**
- `customerId`
- `userId`
- `createdAt`

---

### 7. **sales** - Sotuvlar (Offline Sync)

```typescript
interface Sale {
  _id: ObjectId;
  offlineId?: string;         // Offline UUID
  recipientNumber?: string;   // Chek raqami
  userId: ObjectId;
  branchId?: ObjectId;
  cashier: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  items: SaleItem[];
  total: number;
  paymentType: PaymentType;
  saleType: 'sale' | 'refund';
  customerId?: ObjectId;
  offlineCreatedAt?: Date;    // Offline yaratilgan vaqt
  createdAt: Date;
}
```

**Indexes:**
- `userId`
- `offlineId` (unique, sparse)
- `recipientNumber` (unique, sparse)
- `offlineCreatedAt`
- `createdAt`

---

### 8. **debts** - Qarzlar

```typescript
interface Debt {
  _id: ObjectId;
  creditor: string;           // Qarz oluvchi
  phone?: string;
  countryCode?: string;
  amount: number;
  currency: Currency;
  description?: string;
  debtDate: Date;
  dueDate?: Date;             // To'lov muddati
  status: DebtStatus;
  userId: ObjectId;
  branchId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

type DebtStatus = 'pending' | 'paid' | 'overdue' | 'unpaid';
```

**Indexes:**
- `userId`
- `status`
- `dueDate`
- `phone`

---

### 9. **debt_history** - Qarz Tarixi

```typescript
interface DebtHistory {
  _id: ObjectId;
  debtId: ObjectId;
  action: string;             // 'created' | 'paid' | 'adjusted' | 'unpaid'
  amount?: number;
  reason?: string;
  userId: ObjectId;
  createdAt: Date;
}
```

**Indexes:**
- `debtId`
- `createdAt`

---

### 10. **blacklist** - Qora Ro'yxat

```typescript
interface Blacklist {
  _id: ObjectId;
  phone: string;
  countryCode?: string;
  creditor: string;
  reason: string;
  amount: number;
  currency: Currency;
  userId: ObjectId;
  createdAt: Date;
}
```

**Indexes:**
- `phone` (unique per user)
- `userId`

---

### 11. **cash_register** - Kassa Cheklari

```typescript
interface CashRegister {
  _id: ObjectId;
  userId: ObjectId;
  type: 'current' | 'pending';
  items: CartItem[];
  customerId?: ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `userId, type` (compound)

---

### 12. **defective_products** - Yaroqsiz Mahsulotlar

```typescript
interface DefectiveProduct {
  _id: ObjectId;
  productId: ObjectId;
  name: string;
  sku: string;
  quantity: number;
  reason: string;
  userId: ObjectId;
  date: Date;
  createdAt: Date;
}
```

**Indexes:**
- `userId`
- `date`

---

## 🔗 Relationships (Munosabatlar)

### 1. **User → Products (One-to-Many)**
```typescript
// Foydalanuvchining barcha mahsulotlari
const products = await Product.find({ userId: user._id });
```

### 2. **Category → Products (One-to-Many)**
```typescript
// Kategoriya mahsulotlari
const products = await Product.find({ categoryId: category._id });
```

### 3. **Customer → Orders (One-to-Many)**
```typescript
// Mijoz buyurtmalari
const orders = await Order.find({ customerId: customer._id });
```

### 4. **Product → Parent/Child (Self-Referencing)**
```typescript
// Ota mahsulot
const parent = await Product.findById(product.parentProductId);

// Bola mahsulotlar
const children = await Product.find({ parentProductId: parent._id });
```

---

## 🔍 Queries (So'rovlar)

### 1. **Mahsulot Qidirish:**
```typescript
// Text search
const products = await Product.find({
  $text: { $search: query },
  userId: user._id,
});

// Regex search
const products = await Product.find({
  name: { $regex: query, $options: 'i' },
  userId: user._id,
});
```

### 2. **Aggregation Pipeline:**
```typescript
// Eng ko'p sotiladigan mahsulotlar
const topProducts = await Sale.aggregate([
  { $match: { userId: user._id } },
  { $unwind: '$items' },
  {
    $group: {
      _id: '$items.productId',
      name: { $first: '$items.name' },
      totalQuantity: { $sum: '$items.quantity' },
      totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
    },
  },
  { $sort: { totalQuantity: -1 } },
  { $limit: 10 },
]);
```

### 3. **Kunlik Statistika:**
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);

const dailyStats = await Sale.aggregate([
  {
    $match: {
      userId: user._id,
      offlineCreatedAt: { $gte: today },
    },
  },
  {
    $group: {
      _id: null,
      totalSales: { $sum: 1 },
      totalRevenue: { $sum: '$total' },
      totalQuantity: { $sum: { $sum: '$items.quantity' } },
    },
  },
]);
```

---

## 🔐 Security (Xavfsizlik)

### 1. **User Isolation:**
```typescript
// Har bir so'rovda userId tekshirish
const products = await Product.find({
  userId: user._id,  // MUHIM!
});
```

### 2. **Password Hashing:**
```typescript
import bcrypt from 'bcryptjs';

// Password hash qilish
const hashedPassword = await bcrypt.hash(password, 10);

// Password tekshirish
const isValid = await bcrypt.compare(password, user.password);
```

### 3. **Input Validation:**
```typescript
import { z } from 'zod';

const productSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(50),
  price: z.number().positive(),
  stock: z.number().int().min(0),
});
```

---

## 🚀 Performance Optimization

### 1. **Indexes:**
```typescript
// Compound index
productSchema.index({ sku: 1, userId: 1 }, { unique: true });

// Text index
productSchema.index({ name: 'text', description: 'text' });
```

### 2. **Lean Queries:**
```typescript
// Mongoose document emas, oddiy object qaytarish
const products = await Product.find({ userId: user._id }).lean();
```

### 3. **Select Fields:**
```typescript
// Faqat kerakli fieldlarni olish
const products = await Product.find({ userId: user._id })
  .select('name sku price stock');
```

### 4. **Pagination:**
```typescript
const page = 1;
const limit = 20;

const products = await Product.find({ userId: user._id })
  .skip((page - 1) * limit)
  .limit(limit);
```

---

## 🔄 Migrations (Migratsiyalar)

### 1. **Add Field:**
```typescript
// Barcha mahsulotlarga yangi field qo'shish
await Product.updateMany(
  { source: { $exists: false } },
  { $set: { source: 'manual' } }
);
```

### 2. **Rename Field:**
```typescript
// Field nomini o'zgartirish
await Product.updateMany(
  {},
  { $rename: { 'oldField': 'newField' } }
);
```

### 3. **Data Transformation:**
```typescript
// Ma'lumotlarni o'zgartirish
const products = await Product.find({});

for (const product of products) {
  product.sku = product.sku.toUpperCase();
  await product.save();
}
```

---

## 📊 Backup va Restore

### 1. **Backup:**
```bash
# MongoDB dump
mongodump --db avtofix --out /backup/$(date +%Y%m%d)

# Specific collection
mongodump --db avtofix --collection products --out /backup/products
```

### 2. **Restore:**
```bash
# MongoDB restore
mongorestore --db avtofix /backup/20250210

# Specific collection
mongorestore --db avtofix --collection products /backup/products/products.bson
```

### 3. **Automated Backup:**
```typescript
// Kunlik backup (cron job)
import { exec } from 'child_process';

const backupDatabase = () => {
  const date = new Date().toISOString().split('T')[0];
  const command = `mongodump --db avtofix --out /backup/${date}`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('Backup error:', error);
    } else {
      console.log('Backup success:', stdout);
    }
  });
};

// Har kuni soat 2:00 da
cron.schedule('0 2 * * *', backupDatabase);
```

---

## 📈 Monitoring

### 1. **Database Stats:**
```typescript
const stats = await mongoose.connection.db.stats();
console.log('Database size:', stats.dataSize);
console.log('Collections:', stats.collections);
```

### 2. **Slow Queries:**
```typescript
// Mongoose debug mode
mongoose.set('debug', true);

// Slow query log
mongoose.set('debug', (collectionName, method, query, doc) => {
  console.log(`${collectionName}.${method}`, JSON.stringify(query));
});
```

---

**Yaratilgan:** 2025-02-10
**Versiya:** 1.0.0
**Muallif:** AvtoFix Development Team
