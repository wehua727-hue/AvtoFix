const fetch = require('node-fetch');

async function testServerAPI() {
  try {
    console.log('\n🧪 TESTING SERVER API');
    console.log('Checking if server returns correct stock values');
    console.log('=' .repeat(50));
    
    const apiUrl = 'http://127.0.0.1:5175/api/products?userId=693d2d63ba2fae9ff378c33a&userPhone=998914058481&limit=10';
    
    console.log('📡 Fetching from:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const data = await response.json();
    const products = Array.isArray(data) ? data : data.products || [];
    
    console.log(`✅ Received ${products.length} products from server`);
    
    // Find SKU "1" product
    const sku1Product = products.find(p => p.sku === "1");
    
    if (sku1Product) {
      console.log('\n📦 SKU "1" Product from API:');
      console.log(`   Name: ${sku1Product.name}`);
      console.log(`   Stock: ${sku1Product.stock} (should be 0)`);
      console.log(`   StockCount: ${sku1Product.stockCount || 'undefined'}`);
      console.log(`   InitialStock: ${sku1Product.initialStock || 'undefined'}`);
      
      if (sku1Product.variantSummaries && sku1Product.variantSummaries.length > 0) {
        console.log(`   Variants:`);
        sku1Product.variantSummaries.forEach((v, i) => {
          console.log(`     [${i}] ${v.name}`);
          console.log(`         Stock: ${v.stock}`);
          console.log(`         StockCount: ${v.stockCount || 'undefined'}`);
          console.log(`         InitialStock: ${v.initialStock || 'undefined'}`);
        });
      }
      
      // Test result
      if (sku1Product.stock === 0) {
        console.log('\n✅ SUCCESS: Server API returns correct stock (0)');
        console.log('✅ Stock priority should work correctly now');
      } else {
        console.log(`\n❌ FAILURE: Server API still returns stock: ${sku1Product.stock}`);
        console.log('❌ Fallback logic still active in server');
      }
    } else {
      console.log('\n❌ SKU "1" product not found in API response');
    }
    
    // Find SKU "5" product
    const sku5Product = products.find(p => p.sku === "5");
    
    if (sku5Product) {
      console.log('\n📦 SKU "5" Product from API:');
      console.log(`   Name: ${sku5Product.name}`);
      console.log(`   Stock: ${sku5Product.stock}`);
      console.log(`   StockCount: ${sku5Product.stockCount || 'undefined'}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing server API:', error.message);
    console.log('\n💡 Make sure server is running:');
    console.log('   cd server && npm run dev');
  }
}

testServerAPI().catch(console.error);