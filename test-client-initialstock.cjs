/**
 * Test client-side initialStock reception
 */

const fetch = require('node-fetch');

async function testClientInitialStock() {
  try {
    const userId = '694a8cf599adb50cf1248e50';
    const userPhone = '998914058481';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    
    const url = `http://127.0.0.1:5175/api/products?userId=${userId}&userPhone=${userPhone}&limit=50000&_t=${timestamp}&_r=${randomId}&_nocache=true`;
    
    console.log('🔍 Testing client API call...');
    console.log('URL:', url);
    
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
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Response received, products count:', data.length);
    
    // Find SKU "1" product
    const sku1Product = data.find(p => p.sku === "1" || p.sku === 1);
    if (sku1Product) {
      console.log('\n📦 SKU "1" product analysis:');
      console.log('Name:', sku1Product.name);
      console.log('Stock:', sku1Product.stock);
      console.log('InitialStock:', sku1Product.initialStock);
      console.log('InitialStock type:', typeof sku1Product.initialStock);
      console.log('Has initialStock property:', sku1Product.hasOwnProperty('initialStock'));
      console.log('InitialStock === undefined:', sku1Product.initialStock === undefined);
      console.log('InitialStock === null:', sku1Product.initialStock === null);
      console.log('InitialStock > 0:', sku1Product.initialStock > 0);
    } else {
      console.log('❌ SKU "1" product not found');
    }
    
    // Check all products for initialStock
    const withInitialStock = data.filter(p => 
      p.hasOwnProperty('initialStock') && 
      p.initialStock !== undefined && 
      p.initialStock !== null && 
      p.initialStock > 0
    );
    const withoutInitialStock = data.filter(p => 
      !p.hasOwnProperty('initialStock') || 
      p.initialStock === undefined || 
      p.initialStock === null || 
      p.initialStock <= 0
    );
    
    console.log('\n📊 InitialStock statistics:');
    console.log(`✅ With initialStock: ${withInitialStock.length}`);
    console.log(`❌ Without initialStock: ${withoutInitialStock.length}`);
    console.log(`📦 Total products: ${data.length}`);
    
    if (withoutInitialStock.length > 0) {
      console.log('\n❌ Products without initialStock (first 5):');
      withoutInitialStock.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. SKU: "${p.sku}" | Name: ${p.name} | Stock: ${p.stock} | InitialStock: ${p.initialStock}`);
      });
    }
    
    if (withInitialStock.length > 0) {
      console.log('\n✅ Products with initialStock (first 5):');
      withInitialStock.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. SKU: "${p.sku}" | Name: ${p.name} | Stock: ${p.stock} | InitialStock: ${p.initialStock}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testClientInitialStock().catch(console.error);