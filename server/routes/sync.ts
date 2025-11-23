import { RequestHandler } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { connectMongo } from '../mongo';
import { Product, SyncResponse } from '@shared/types';

const PRODUCTS_COLLECTION = process.env.OFFLINE_PRODUCTS_COLLECTION || 'products';
const ObjectId = mongoose.Types.ObjectId;

interface ProductDoc {
  _id: any;
  name?: string;
  price?: number;
  sku?: string;
  categoryId?: any;
  stock?: number;
  imagePath?: string | null;
  sizes?: string[];
  variants?: any[];
  store?: any;
  status?: string;
  video?: any;
  synced?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export const handleProductsSync: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({
        success: false,
        message: 'MongoDB ulanmagan',
        syncedIds: [],
      });
    }

    const { products } = req.body as { products?: Product[] };

    if (!Array.isArray(products) || products.length === 0) {
      return res.json({
        success: true,
        syncedIds: [],
        message: 'No products to sync',
      });
    }

    const db = conn.db;
    const collection = db.collection(PRODUCTS_COLLECTION);
    const syncedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    console.log(`[api/products/sync] Syncing ${products.length} products...`);

    // Process each product
    for (const product of products) {
      try {
        const productId = product.id;

        // Prepare document for upsert
        const doc: any = {
          name: product.name,
          sku: product.sku,
          price: product.price,
          stock: product.stock,
          status: product.status || 'available',
          imagePath: product.imageUrl,
          updatedAt: new Date(),
        };

        if (product.categoryId) {
          try {
            doc.categoryId = new ObjectId(product.categoryId);
          } catch {
            doc.categoryId = product.categoryId;
          }
        }

        if (product.store) {
          try {
            doc.store = new ObjectId(product.store);
          } catch {
            doc.store = product.store;
          }
        }

        if (product.sizes && product.sizes.length > 0) {
          doc.sizes = product.sizes;
        }

        if (product.variants && product.variants.length > 0) {
          doc.variants = product.variants;
        }

        if (product.video) {
          doc.video = product.video;
        }

        // Upsert: update if exists, insert if not
        let query: any;
        try {
          query = { _id: new ObjectId(productId) };
        } catch {
          query = { _id: productId };
        }

        const result = await collection.updateOne(
          query,
          { $set: doc },
          { upsert: true }
        );

        console.log(`[api/products/sync] Synced product ${productId}:`, {
          matched: result.matchedCount,
          modified: result.modifiedCount,
          upserted: result.upsertedCount,
        });

        syncedIds.push(productId);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[api/products/sync] Error syncing product ${product.id}:`, errorMsg);
        errors.push({
          id: product.id,
          error: errorMsg,
        });
      }
    }

    console.log(`[api/products/sync] Sync complete: ${syncedIds.length} synced, ${errors.length} errors`);

    return res.json({
      success: true,
      syncedIds,
      errors: errors.length > 0 ? errors : undefined,
      message: `Synced ${syncedIds.length} products`,
    } as SyncResponse);
  } catch (err) {
    console.error('[api/products/sync] error', err);
    return res.status(500).json({
      success: false,
      message: 'Server xatosi',
      syncedIds: [],
    });
  }
};

export const handleGetAllProducts: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(200).json({ products: [], message: 'MongoDB ulanmagan' });
    }

    const db = conn.db;
    const raw: ProductDoc[] = await db
      .collection(PRODUCTS_COLLECTION)
      .find({})
      .sort({ createdAt: -1 })
      .limit(1000)
      .toArray();

    const products = raw.map((p) => ({
      id: p._id?.toString?.() ?? '',
      name: p.name ?? '',
      price: typeof p.price === 'number' ? p.price : null,
      basePrice: typeof (p as any).basePrice === 'number' ? (p as any).basePrice : null,
      priceMultiplier: typeof (p as any).priceMultiplier === 'number' ? (p as any).priceMultiplier : null,
      sku: p.sku ?? '',
      categoryId: p.categoryId ? p.categoryId.toString?.() ?? null : null,
      stock: typeof p.stock === 'number' ? p.stock : null,
      sizes: Array.isArray(p.sizes) ? p.sizes : [],
      variants: Array.isArray(p.variants) ? p.variants : [],
      imageUrl: p.imagePath || null,
      video: p.video || null,
      store: p.store ? p.store.toString?.() ?? null : null,
      status: p.status || 'available',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return res.json({ products });
  } catch (err) {
    console.error('[api/products/getAll] error', err);
    return res.status(500).json({ products: [], message: 'Server xatosi' });
  }
};

// Create single product (basic JSON payload with optional imageBase64)
export const handleCreateProduct: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, message: 'MongoDB ulanmagan' });
    }

    const {
      name,
      sku,
      price,
      basePrice,
      priceMultiplier,
      stock,
      categoryId,
      store,
      status,
      sizes,
      variants,
      imageBase64,
      video,
    } = req.body || {};

    if (!name || !sku) {
      return res.status(400).json({ success: false, message: 'name va sku kerak' });
    }

    const db = conn.db;

    // Save image if provided as data URL/base64
    let imagePath: string | null = null;
    if (typeof imageBase64 === 'string' && imageBase64.startsWith('data:')) {
      try {
        const match = imageBase64.match(/^data:(.*?);base64,(.*)$/);
        if (match) {
          const contentType = match[1] || 'image/jpeg';
          const base64Data = match[2];
          const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
          const uploadsDir = process.env.UPLOADS_DIR || 'uploads';
          const filename = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const absDir = path.join(process.cwd(), uploadsDir);
          const absPath = path.join(absDir, filename);
          if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });
          fs.writeFileSync(absPath, Buffer.from(base64Data, 'base64'));
          imagePath = `/${uploadsDir}/${filename}`.replace(/\\/g, '/');
        }
      } catch (e) {
        console.error('[api/products POST] Failed to save image', e);
      }
    }

    // Prepare Mongo document
    const doc: any = {
      name: String(name),
      sku: String(sku),
      price: typeof price === 'number' ? price : Number(price) || 0,
      basePrice: typeof basePrice === 'number' ? basePrice : (basePrice != null ? Number(basePrice) : null),
      priceMultiplier: typeof priceMultiplier === 'number' ? priceMultiplier : (priceMultiplier != null ? Number(priceMultiplier) : null),
      stock: typeof stock === 'number' ? stock : Number(stock) || 0,
      status: status || 'available',
      imagePath,
      variants: Array.isArray(variants) ? variants : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Optional fields that may be ObjectIds
    const tryObjectId = (v: any) => {
      if (v == null) return v;
      try { return new mongoose.Types.ObjectId(String(v)); } catch { return v; }
    };

    if (categoryId != null) doc.categoryId = tryObjectId(categoryId);
    if (store != null) doc.store = tryObjectId(store);
    if (typeof sizes === 'string') {
      doc.sizes = sizes.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else if (Array.isArray(sizes)) {
      doc.sizes = sizes;
    }
    if (video) doc.video = video;

    const result = await db.collection(PRODUCTS_COLLECTION).insertOne(doc);

    const product = {
      id: result.insertedId.toString(),
      name: doc.name,
      sku: doc.sku,
      price: doc.price,
      basePrice: doc.basePrice,
      priceMultiplier: doc.priceMultiplier,
      stock: doc.stock,
      categoryId: doc.categoryId ? (doc.categoryId.toString?.() ?? doc.categoryId) : null,
      store: doc.store ? (doc.store.toString?.() ?? doc.store) : null,
      status: doc.status,
      imageUrl: doc.imagePath,
      sizes: Array.isArray(doc.sizes) ? doc.sizes : [],
      variants: Array.isArray(doc.variants) ? doc.variants : [],
      video: doc.video || null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as Product;

    return res.status(201).json({ success: true, product });
  } catch (err) {
    console.error('[api/products POST] error', err);
    return res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

// Update single product
export const handleUpdateProduct: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, message: 'MongoDB ulanmagan' });
    }

    const { id } = req.params as { id: string };
    if (!id) return res.status(400).json({ success: false, message: 'id kerak' });

    const {
      name,
      sku,
      price,
      basePrice,
      priceMultiplier,
      stock,
      categoryId,
      store,
      status,
      sizes,
      variants,
      imageBase64,
      video,
    } = req.body || {};

    const db = conn.db;

    let _id: any;
    try {
      _id = new mongoose.Types.ObjectId(id);
    } catch {
      _id = id;
    }

    const update: any = { updatedAt: new Date() };
    if (typeof name === 'string') update.name = name;
    if (typeof sku === 'string') update.sku = sku;
    if (price !== undefined) update.price = typeof price === 'number' ? price : Number(price) || 0;
    if (basePrice !== undefined) update.basePrice = typeof basePrice === 'number' ? basePrice : (basePrice != null ? Number(basePrice) : null);
    if (priceMultiplier !== undefined) update.priceMultiplier = typeof priceMultiplier === 'number' ? priceMultiplier : (priceMultiplier != null ? Number(priceMultiplier) : null);
    if (stock !== undefined) update.stock = typeof stock === 'number' ? stock : Number(stock) || 0;
    if (typeof status === 'string') update.status = status;
    if (Array.isArray(variants)) update.variants = variants;
    if (typeof sizes === 'string') {
      update.sizes = sizes.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else if (Array.isArray(sizes)) {
      update.sizes = sizes;
    }
    if (video !== undefined) update.video = video;

    if (categoryId !== undefined) {
      try { update.categoryId = new mongoose.Types.ObjectId(String(categoryId)); } catch { update.categoryId = categoryId; }
    }
    if (store !== undefined) {
      try { update.store = new mongoose.Types.ObjectId(String(store)); } catch { update.store = store; }
    }

    if (typeof imageBase64 === 'string' && imageBase64.startsWith('data:')) {
      try {
        const match = imageBase64.match(/^data:(.*?);base64,(.*)$/);
        if (match) {
          const contentType = match[1] || 'image/jpeg';
          const base64Data = match[2];
          const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
          const uploadsDir = process.env.UPLOADS_DIR || 'uploads';
          const filename = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const absDir = path.join(process.cwd(), uploadsDir);
          const absPath = path.join(absDir, filename);
          if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });
          fs.writeFileSync(absPath, Buffer.from(base64Data, 'base64'));
          update.imagePath = `/${uploadsDir}/${filename}`.replace(/\\/g, '/');
        }
      } catch (e) {
        console.error('[api/products PUT] Failed to save image', e);
      }
    } else if (imageBase64 === '') {
      update.imagePath = null;
    }

    const result = await db.collection(PRODUCTS_COLLECTION).findOneAndUpdate(
      { _id },
      { $set: update },
      { returnDocument: 'after', upsert: true }
    );

    if (!result.value) {
      // Should not happen with upsert:true, but handle defensively
      return res.status(500).json({ success: false, message: 'Mahsulotni yangilash/yaratishda xatolik' });
    }

    const p = result.value as ProductDoc;
    const product = {
      id: p._id?.toString?.() ?? '',
      name: p.name ?? '',
      price: typeof p.price === 'number' ? p.price : null,
      basePrice: typeof (p as any).basePrice === 'number' ? (p as any).basePrice : null,
      priceMultiplier: typeof (p as any).priceMultiplier === 'number' ? (p as any).priceMultiplier : null,
      sku: p.sku ?? '',
      categoryId: p.categoryId ? p.categoryId.toString?.() ?? null : null,
      stock: typeof p.stock === 'number' ? p.stock : null,
      sizes: Array.isArray(p.sizes) ? p.sizes : [],
      variants: Array.isArray(p.variants) ? p.variants : [],
      imageUrl: p.imagePath || null,
      video: p.video || null,
      store: p.store ? p.store.toString?.() ?? null : null,
      status: p.status || 'available',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    } as Product;

    return res.json({ success: true, product });
  } catch (err) {
    console.error('[api/products PUT] error', err);
    return res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

// Delete single product
export const handleDeleteProduct: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, message: 'MongoDB ulanmagan' });
    }
    const { id } = req.params as { id: string };
    if (!id) return res.status(400).json({ success: false, message: 'id kerak' });
    const db = conn.db;
    let _id: any;
    try { _id = new mongoose.Types.ObjectId(id); } catch { _id = id; }
    const result = await db.collection(PRODUCTS_COLLECTION).deleteOne({ _id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Mahsulot topilmadi' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[api/products DELETE] error', err);
    return res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};
