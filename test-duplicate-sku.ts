import { MongoClient } from 'mongodb';

async function testDuplicateSku() {
  const uri = "mongodb+srv://avtofix2025_db_user:FTnjYsHxkYxgu7qH@cluster0.b2fwuli.mongodb.net/";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ MongoDB ga ulandi');
    
    const db = client.db('avtofix');
    const collection = db.collection('products');
    
    // User ID (910712828 telefon raqami)
    const userId = '6974aea9af7ded62a69472c4';
    
    console.log('=== DUPLICATE SKU TEST ===');
    
    // 1. Mavjud SKU ni topish
    const existingProduct = await collection.findOne({ 
      userId: userId,
      sku: { $exists: true, $ne: null, $ne: '' }
    });
    
    if (!existingProduct) {
      console.log('❌ Test uchun mavjud SKU topilmadi');
      return;
    }
    
    console.log(`Test uchun SKU: ${existingProduct.sku} (${existingProduct.name})`);
    
    // 2. Duplicate SKU bilan yangi mahsulot yaratishga harakat
    const testProduct = {
      name: 'TEST DUPLICATE MAHSULOT',
      sku: existingProduct.sku, // Bir xil SKU
      price: 100,
      basePrice: 100,
      currency: 'UZS',
      stock: 10,
      status: 'available',
      userId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      source: 'test'
    };
    
    try {
      const result = await collection.insertOne(testProduct);
      console.log('❌ XATO: Duplicate SKU bilan mahsulot yaratildi!', result.insertedId);
    } catch (error) {
      console.log('✅ TO\'G\'RI: Duplicate SKU bilan mahsulot yaratilmadi');
      console.log('Xatolik:', error);
    }
    
    // 3. API orqali test qilish
    console.log('\n=== API ORQALI TEST ===');
    
    const apiUrl = 'http://localhost:5176/api/products';
    const apiPayload = {
      name: 'TEST API DUPLICATE',
      sku: existingProduct.sku,
      price: 200,
      basePrice: 200,
      currency: 'UZS',
      stock: 5,
      status: 'available',
      userId: userId
    };
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiPayload)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('❌ XATO: API orqali duplicate SKU bilan mahsulot yaratildi!');
        console.log('Response:', data);
      } else {
        console.log('✅ TO\'G\'RI: API duplicate SKU ni rad etdi');
        console.log('Xatolik:', data.error);
        console.log('Tavsiya etilgan SKU:', data.suggestedSku);
      }
    } catch (apiError) {
      console.log('API test xatolik:', apiError);
    }
    
  } catch (error) {
    console.error('Test xatolik:', error);
  } finally {
    await client.close();
    console.log('\n✓ Database ulanishi yopildi');
  }
}

testDuplicateSku().catch(console.error);