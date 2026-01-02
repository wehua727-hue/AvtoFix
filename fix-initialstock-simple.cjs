/**
 * Simple fix for initialStock using server API
 */

const API_BASE_URL = 'http://127.0.0.1:5175';

async function fixInitialStockViaAPI() {
  try {
    console.log('🔧 Fixing initialStock via API...');
    
    // Get all products
    const response = await fetch(`${API_BASE_URL}/api/products?limit=50000&_nocache=true`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const products = await response.json();
    console.log(`📦 Found ${products.length} products`);
    
    let fixedCount = 0;
    
    for (const product of products) {
      // Check if initialStock is missing or 0
      if (!product.initialStock || product.initialStock <= 0) {
        const currentStock = product.stock || 0;
        
        console.log(`Fixing SKU "${product.sku}": stock=${currentStock}, initialStock=${product.initialStock}`);
        
        // Update via API using PUT endpoint
        const updateResponse = await fetch(`${API_BASE_URL}/api/products/${product._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            initialStock: currentStock
          })
        });
        
        if (updateResponse.ok) {
          console.log(`✅ Fixed SKU "${product.sku}": initialStock set to ${currentStock}`);
          fixedCount++;
        } else {
          console.error(`❌ Failed to fix SKU "${product.sku}"`);
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`🎉 Fixed ${fixedCount} products!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixInitialStockViaAPI().catch(console.error);