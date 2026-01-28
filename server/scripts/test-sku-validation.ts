import axios from 'axios';

async function testSkuValidation() {
  const baseUrl = 'http://localhost:5175/api';
  const userId = '6974aea9af7ded62a69472c4';
  
  console.log('=== SKU VALIDATION TEST ===');
  
  try {
    // 1. Mavjud SKU bilan mahsulot yaratishga harakat
    console.log('\n1. Mavjud SKU (562) bilan mahsulot yaratish...');
    
    const duplicateTest = await axios.post(`${baseUrl}/products`, {
      name: 'Test mahsulot - duplicate SKU',
      sku: '562', // Bu SKU allaqachon mavjud
      price: 10000,
      userId: userId
    });
    
    console.log('❌ Xato: Duplicate SKU qabul qilindi!', duplicateTest.data);
    
  } catch (error: any) {
    if (error.response?.status === 400) {
      console.log('✅ To\'g\'ri: Duplicate SKU rad etildi');
      console.log('Xabar:', error.response.data.error);
    } else {
      console.log('❌ Kutilmagan xato:', error.message);
    }
  }
  
  try {
    // 2. Yangi SKU bilan mahsulot yaratish
    console.log('\n2. Yangi SKU bilan mahsulot yaratish...');
    
    const newProduct = await axios.post(`${baseUrl}/products`, {
      name: 'Test mahsulot - yangi SKU',
      sku: '9999', // Bu SKU mavjud emas
      price: 15000,
      userId: userId
    });
    
    console.log('✅ Yangi mahsulot yaratildi:', newProduct.data.product?.name);
    
    // Yaratilgan mahsulotni o'chirish
    if (newProduct.data.product?._id) {
      await axios.delete(`${baseUrl}/products/${newProduct.data.product._id}`);
      console.log('✅ Test mahsulot o\'chirildi');
    }
    
  } catch (error: any) {
    console.log('❌ Yangi mahsulot yaratishda xato:', error.response?.data || error.message);
  }
  
  try {
    // 3. Mavjud mahsulotni duplicate SKU bilan yangilash
    console.log('\n3. Mavjud mahsulotni duplicate SKU bilan yangilash...');
    
    // Avval biror mahsulot ID sini olish
    const products = await axios.get(`${baseUrl}/products?userId=${userId}`);
    const firstProduct = products.data[0];
    
    if (firstProduct) {
      const updateTest = await axios.put(`${baseUrl}/products/${firstProduct._id}`, {
        ...firstProduct,
        sku: '562' // Mavjud SKU
      });
      
      console.log('❌ Xato: Duplicate SKU bilan yangilash qabul qilindi!');
    }
    
  } catch (error: any) {
    if (error.response?.status === 400) {
      console.log('✅ To\'g\'ri: Duplicate SKU bilan yangilash rad etildi');
      console.log('Xabar:', error.response.data.error);
    } else {
      console.log('❌ Kutilmagan xato:', error.message);
    }
  }
  
  console.log('\n=== TEST YAKUNLANDI ===');
}

testSkuValidation().catch(console.error);