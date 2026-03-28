# 🔌 WEBSOCKET - Real-time Updates

## 📋 Umumiy Ma'lumot

**Fayl:** `server/websocket.ts`

**Texnologiya:** ws (WebSocket library)

**URL:** `wss://shop.avtofix.uz/ws`

---

## 🎯 Asosiy Funksiyalar

### 1. Connection
```typescript
const ws = new WebSocket('wss://shop.avtofix.uz/ws');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleMessage(data);
};
```

### 2. Xabar Turlari

#### Product Update:
```typescript
{
  type: 'product_update',
  data: {
    productId: '...',
    stock: 50
  }
}
```

#### Sale Created:
```typescript
{
  type: 'sale_created',
  data: {
    saleId: '...',
    total: 150000
  }
}
```

#### User Status:
```typescript
{
  type: 'user_status',
  data: {
    userId: '...',
    online: true
  }
}
```

---

## 📡 Broadcast

### Barcha Clientlarga:
```typescript
wsManager.broadcast({
  type: 'notification',
  message: 'Yangi mahsulot qo\'shildi'
});
```

### Faqat Bir Foydalanuvchiga:
```typescript
wsManager.sendToUser(userId, {
  type: 'notification',
  message: 'Sizga xabar'
});
```

---

## 🔄 Reconnection

### Avtomatik Qayta Ulanish:
```typescript
let reconnectInterval = 1000;

ws.onclose = () => {
  setTimeout(() => {
    connect();
    reconnectInterval *= 2; // Exponential backoff
  }, reconnectInterval);
};
```

---

## 🔐 Authentication

### Token Yuborish:
```typescript
ws.send(JSON.stringify({
  type: 'auth',
  token: 'Bearer ...'
}));
```

---

**Yaratilgan:** 2025-02-10
