/**
 * Product sync routes for offline-first functionality
 * Handles bulk synchronization with idempotency
 */

import { RequestHandler } from 'express';
import { ProductModel } from '../product.model';

interface OfflineProduct {
  offlineId: string;
  name: string;
  price?: number;
  description?: string;
  category?: string;
  stock?: number;
  imageUrl?: string;
  createdAt: string;
}

/**
 * Bulk sync endpoint - accepts multiple products from offline storage
 * Uses offlineId for idempotency (prevents duplicate inserts)
 */
export const handleBulkSync: RequestHandler = async (req, res) => {
  try {
    const { products } = req.body as { products?: OfflineProduct[] };

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        message: 'products array is required',
      });
    }

    if (products.length === 0) {
      return res.json({
        success: true,
        message: 'No products to sync',
        syncedCount: 0,
      });
    }

    console.log(`[Sync] Received ${products.length} products for bulk sync`);

    const results = {
      synced: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each product
    for (const product of products) {
      try {
        // Validate required fields
        if (!product.offlineId || !product.name) {
          results.errors.push(
            `Invalid product: missing offlineId or name`
          );
          continue;
        }

        // Check if product with this offlineId already exists
        const existing = await ProductModel.findOne({
          offlineId: product.offlineId,
        });

        if (existing) {
          console.log(`[Sync] Product ${product.offlineId} already exists, skipping`);
          results.skipped++;
          continue;
        }

        // Create new product with offlineId for idempotency
        await ProductModel.create({
          offlineId: product.offlineId,
          name: product.name.trim(),
          price: product.price || 0,
          description: product.description || '',
          category: product.category || '',
          stock: product.stock || 0,
          initialStock: product.stock || 0,
          imageUrl: product.imageUrl || '',
          sizes: [], // Default empty array
          images: [], // Default empty array
          createdAt: product.createdAt ? new Date(product.createdAt) : new Date(),
        });

        results.synced++;
        console.log(`[Sync] Created product ${product.offlineId}`);
        
      } catch (error) {
        console.error(`[Sync] Error processing product ${product.offlineId}:`, error);
        results.errors.push(
          `Failed to sync ${product.offlineId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    console.log(`[Sync] Bulk sync complete: ${results.synced} synced, ${results.skipped} skipped, ${results.errors.length} errors`);

    return res.json({
      success: true,
      message: 'Bulk sync completed',
      syncedCount: results.synced,
      skippedCount: results.skipped,
      errors: results.errors,
    });
    
  } catch (error) {
    console.error('[Sync] Bulk sync error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during bulk sync',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Single product create endpoint with idempotency
 */
export const handleCreateProduct: RequestHandler = async (req, res) => {
  try {
    const { offlineId, name, price, description, category, stock, imageUrl } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'name is required',
      });
    }

    // If offlineId provided, check for duplicates
    if (offlineId) {
      const existing = await ProductModel.findOne({ offlineId });
      if (existing) {
        console.log(`[Create] Product ${offlineId} already exists`);
        return res.json({
          success: true,
          message: 'Product already exists',
          product: existing,
          duplicate: true,
        });
      }
    }

    // Create product
    const product = await ProductModel.create({
      offlineId: offlineId || undefined,
      name: name.trim(),
      price: price || 0,
      description: description || '',
      category: category || '',
      stock: stock || 0,
      initialStock: stock || 0, // Set initialStock on creation
      imageUrl: imageUrl || '',
      sizes: [],
      images: [],
    });

    console.log(`[Create] Created product ${product._id}`);

    return res.status(201).json({
      success: true,
      product,
      duplicate: false,
    });
    
  } catch (error) {
    console.error('[Create] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get sync status - returns count of products by offlineId
 */
export const handleSyncStatus: RequestHandler = async (req, res) => {
  try {
    const totalProducts = await ProductModel.countDocuments();
    const syncedProducts = await ProductModel.countDocuments({
      offlineId: { $exists: true, $ne: null },
    });

    return res.json({
      success: true,
      totalProducts,
      syncedProducts,
      localProducts: totalProducts - syncedProducts,
    });
  } catch (error) {
    console.error('[Sync Status] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
