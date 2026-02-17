# VPS Database Tekshirish

Ehtimol VPS'dagi database'da history bor. Keling tekshiramiz:

## 1. VPS'ga Kirish

```bash
ssh user@shop.avtofix.uz
```

## 2. MongoDB'ga Ulanish

```bash
mongosh
```

## 3. Database Tanlash

```javascript
use avtofix
```

## 4. History Tekshirish

```javascript
// Jami history soni
db.product_history.countDocuments()

// Oxirgi 10 ta history
db.product_history.find().sort({createdAt: -1}).limit(10).pretty()

// Kechagi soat 17:00 dagi history
db.product_history.find({
  type: 'delete',
  createdAt: {
    $gte: ISODate('2025-02-16T17:00:00.000Z'),
    $lte: ISODate('2025-02-16T17:59:59.999Z')
  }
}).pretty()
```

## 5. Agar History Bo'lsa

Agar VPS'da history bo'lsa, uni local'ga export qilish:

```bash
# VPS'da
mongodump --db avtofix --collection product_history --out /tmp/backup

# Local'ga ko'chirish
scp -r user@shop.avtofix.uz:/tmp/backup ~/Desktop/vps-backup

# Local'da import qilish
mongorestore --db avtofix ~/Desktop/vps-backup/avtofix
```

Keyin local'da restore script ishga tushirish:

```bash
npx tsx scripts/restore-yesterday-17.ts
```

## 6. Agar History Yo'q Bo'lsa

Agar VPS'da ham history yo'q bo'lsa, boshqa yo'llarni tekshirish kerak.
