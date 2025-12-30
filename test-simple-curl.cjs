/**
 * Simple test using Node.js built-in fetch (Node 18+)
 */

async function testApi() {
  console.log('🔍 Testing API with Node.js fetch...\n');
  
  const userId = '694a8cf599adb50cf1248e50';
  const userPhone = '998914058481';
  const timestamp = Date.now();
  
  // Try both ports
  const ports = [5174, 5175];
  
  for (const port of ports) {
    const url = `http://127.0.0.1:${port}/api/products?userId=${userId}&userPhone=${userPhone}&limit=3&_t=${timestamp}&_nocache=true`;
    
    console.log(`📡 Testing port ${port}:`);
    console.log(`URL: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Port ${port} works! Got ${data.length} products`);
        
        if (data.length > 0) {
          const firstProduct = data[0];
          console.log('📦 First product:');
          console.log('SKU:', firstProduct.sku);
          console.log('Name:', firstProduct.name);
          console.log('Stock:', firstProduct.stock);
          console.log('InitialStock:', firstProduct.initialStock);
          console.log('InitialStock type:', typeof firstProduct.initialStock);
          console.log('Has initialStock property:', firstProduct.hasOwnProperty('initialStock'));
          console.log('Object keys:', Object.keys(firstProduct).join(', '));
        }
        
        return; // Success, exit
      } else {
        console.log(`❌ Port ${port} error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ Port ${port} failed: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('❌ All ports failed!');
}

testApi().catch(console.error);