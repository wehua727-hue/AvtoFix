/**
 * Test API directly to see if initialStock is being returned
 */

const fetch = require('node-fetch');

async function testApiDirect() {
  console.log('🔍 Testing API directly...\n');
  
  const userId = '693d2d63ba2fae9ff378c33a';
  const userPhone = '998914058481';
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  
  // Test local API
  const url = `http://127.0.0.1:5174/api/products?userId=${userId}&userPhone=${userPhone}&limit=10&_t=${timestamp}&_r=${randomId}&_nocache=true`;
  
  console.log('📡 API URL:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT',
        'If-None-Match': '*'
      }
    });
    
    if (!response.ok) {
      console.error('❌ API Error:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.error('❌ API returned non-array data:', typeof data);
      return;
    }
    
    console.log(`✅ API returned ${data.length} products\n`);
    
    // Check first few products
    console.log('📋 First 5 products from API:');
    data.slice(0, 5).forEach((p, i) => {
      console.log(`${i + 1}. SKU: "${p.sku}" | Name: ${p.name} | Stock: ${p.stock} | InitialStock: ${p.initialStock}`);
    });
    
    // Check SKU "1" specifically
    const sku1Product = data.find(p => p.sku === "1");
    if (sku1Product) {
      console.log('\n🎯 SKU "1" from API:');
      console.log('Name:', sku1Product.name);
      console.log('Stock:', sku1Product.stock);
      console.log('InitialStock:', sku1Product.initialStock);
      console.log('Raw object:', JSON.stringify(sku1Product, null, 2));
    } else {
      console.log('\n❌ SKU "1" not found in API response');
    }
    
    // Check initialStock status
    const withInitialStock = data.filter(p => p.initialStock !== undefined && p.initialStock !== null);
    const withoutInitialStock = data.filter(p => p.initialStock === undefined || p.initialStock === null);
    
    console.log(`\n📊 API Response Analysis:`);
    console.log(`✅ Products with initialStock: ${withInitialStock.length}`);
    console.log(`❌ Products without initialStock: ${withoutInitialStock.length}`);
    
    if (withoutInitialStock.length > 0) {
      console.log('\n🚨 Products missing initialStock in API response:');
      withoutInitialStock.slice(0, 3).forEach((p, i) => {
        console.log(`${i + 1}. SKU: "${p.sku}" | Name: ${p.name} | InitialStock: ${p.initialStock}`);
      });
    }
    
  } catch (error) {
    console.error('❌ API Test Error:', error.message);
  }
}

testApiDirect().catch(console.error);