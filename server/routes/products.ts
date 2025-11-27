import { RequestHandler } from "express";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { connectMongo } from "../mongo";
import { compressImageToBuffer } from "../compress";
import { saveVideoToGridFS, deleteVideoFromGridFS, getVideoFromGridFS } from "../gridfs";
import multer from "multer";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = __dirname.includes("dist");
const projectRoot = isProduction ? path.join(__dirname, "..", "..") : path.join(__dirname, "..");
// Base uploads directory (can be overridden by env)
const uploadsBase = path.resolve(process.env.UPLOADS_DIR || path.join(projectRoot, "uploads"));

const ObjectId = mongoose.Types.ObjectId;

const PRODUCTS_COLLECTION = process.env.OFFLINE_PRODUCTS_COLLECTION || "products";
const MAIN_PRODUCTS_COLLECTION = "products";
const PRODUCT_STATUS_VALUES = new Set(["available", "pending", "out-of-stock", "discontinued"]);
const normalizeProductStatus = (value?: string | null) =>
  value && PRODUCT_STATUS_VALUES.has(value) ? value : "available";

interface ProductVariantDoc {
  name?: string;
  options?: string[];
}

interface VariantSummaryDoc {
  name?: string;
  sku?: string; // SKU ni qo'shamiz
  basePrice?: number;
  priceMultiplier?: number;
  price?: number;
  currency?: string; // Variant pul birligi
  stock?: number;
  status?: string;
  imagePaths?: string[];
}

interface ProductDoc {
  _id: any;
  name?: string;
  price?: number;
  basePrice?: number;
  priceMultiplier?: number;
  currency?: string; // Mahsulot pul birligi
  sku?: string;
  categoryId?: any;
  stock?: number;
  imagePath?: string | null;
  imagePaths?: string[]; // Bir nechta rasmlar uchun
  sizes?: string[];
  variants?: ProductVariantDoc[];
  variantSummaries?: VariantSummaryDoc[];
  store?: any;
  status?: string;
  video?: any;
}

export const handleProductsGet: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(200).json({ products: [], message: "MongoDB ulanmagan" });
    }

    const db = conn.db;
    const raw: ProductDoc[] = await db
      .collection(PRODUCTS_COLLECTION)
      .find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    const products = raw.map((p) => {
      const id = p._id?.toString?.() ?? "";
      const normalizedVariants = Array.isArray(p.variants)
        ? p.variants.map((v) => ({
            name: (v.name ?? "").toString().trim(),
            options: Array.isArray(v.options)
              ? v.options.map((o) => o?.toString().trim()).filter(Boolean)
              : [],
          }))
        : [];

      const normalizedSizes = Array.isArray(p.sizes) ? p.sizes : [];
      const sizesFromVariants =
        !normalizedSizes.length && normalizedVariants.length && normalizedVariants[0].options.length
          ? normalizedVariants[0].options
          : normalizedSizes;

      const imageUrl = (p as any).imageUrl || p.imagePath || null;
      const imagePaths = Array.isArray((p as any).imagePaths) && (p as any).imagePaths.length > 0 
        ? (p as any).imagePaths 
        : (imageUrl ? [imageUrl] : []);
      let video = (p as any).video || null;

      if (video && video.gridfsId && !video.url) {
        video = { ...video, url: `/api/products/${id}/video` };
      }

      // Parse variantSummaries if present
      const normalizedVariantSummaries = Array.isArray((p as any).variantSummaries)
        ? (p as any).variantSummaries.map((v: VariantSummaryDoc) => ({
            name: (v.name ?? "").toString().trim(),
            sku: typeof v.sku === "string" ? v.sku.trim() : undefined, // SKU ni qo'shamiz
            basePrice: typeof v.basePrice === "number" ? v.basePrice : undefined,
            priceMultiplier: typeof v.priceMultiplier === "number" ? v.priceMultiplier : undefined,
            price: typeof v.price === "number" ? v.price : undefined,
            currency: typeof v.currency === "string" ? v.currency : undefined, // Variant pul birligi
            stock: typeof v.stock === "number" ? v.stock : undefined,
            status: typeof v.status === "string" ? v.status : undefined,
            imagePaths: Array.isArray(v.imagePaths) ? v.imagePaths : [],
          }))
        : [];

      return {
        id,
        name: p.name ?? "",
        price: typeof p.price === "number" ? p.price : null,
        basePrice: typeof (p as any).basePrice === "number" ? (p as any).basePrice : null,
        priceMultiplier: typeof (p as any).priceMultiplier === "number" ? (p as any).priceMultiplier : null,
        currency: typeof (p as any).currency === "string" ? (p as any).currency : undefined, // Mahsulot pul birligi
        sku: p.sku ?? "",
        categoryId: p.categoryId ? p.categoryId.toString?.() ?? null : null,
        stock: typeof p.stock === "number" ? p.stock : null,
        sizes: sizesFromVariants,
        variants: normalizedVariants,
        variantSummaries: normalizedVariantSummaries,
        imageUrl,
        imagePaths,
        video,
        store: p.store ? p.store.toString?.() ?? null : null,
        status: normalizeProductStatus((p as any).status),
      };
    });

    return res.json({ products });
  } catch (err) {
    console.error("[api/products] error", err);
    return res.status(500).json({ products: [], message: "Server xatosi" });
  }
};

export const handleProductGetById: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, message: "MongoDB ulanmagan" });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "ID kerak" });
    }

    const db = conn.db;
    let query: any;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      query = { _id: id };
    }

    let doc = (await db.collection(PRODUCTS_COLLECTION).findOne(query)) as ProductDoc | null;
    if (!doc) {
      doc = (await db.collection(MAIN_PRODUCTS_COLLECTION).findOne(query)) as ProductDoc | null;
    }

    if (!doc) {
      return res.status(404).json({ success: false, message: "Mahsulot topilmadi" });
    }

    const idStr = doc._id?.toString?.() ?? "";

    let videoData = (doc as any).video || null;
    if (videoData && videoData.gridfsId && !videoData.url) {
      const videoUrl = `/api/products/${idStr}/video`;
      await db.collection(PRODUCTS_COLLECTION).updateOne(
        { _id: doc._id },
        { $set: { "video.url": videoUrl } }
      );
      videoData = { ...videoData, url: videoUrl };
    }

    const normalizedVariants = Array.isArray(doc.variants)
      ? doc.variants.map((v) => ({
          name: (v.name ?? "").toString().trim(),
          options: Array.isArray(v.options)
            ? v.options.map((o) => o?.toString().trim()).filter(Boolean)
            : [],
        }))
      : [];

    const normalizedSizes = Array.isArray(doc.sizes) ? doc.sizes : [];
    const sizesFromVariants =
      !normalizedSizes.length && normalizedVariants.length && normalizedVariants[0].options.length
        ? normalizedVariants[0].options
        : normalizedSizes;

    const imageUrl = (doc as any).imageUrl || doc.imagePath || null;
    const imagePaths = Array.isArray((doc as any).imagePaths) && (doc as any).imagePaths.length > 0 
      ? (doc as any).imagePaths 
      : (imageUrl ? [imageUrl] : []);

    // Parse variantSummaries if present
    const normalizedVariantSummaries = Array.isArray((doc as any).variantSummaries)
      ? (doc as any).variantSummaries.map((v: VariantSummaryDoc) => ({
          name: (v.name ?? "").toString().trim(),
          sku: typeof v.sku === "string" ? v.sku.trim() : undefined, // SKU ni qo'shamiz
          basePrice: typeof v.basePrice === "number" ? v.basePrice : undefined,
          priceMultiplier: typeof v.priceMultiplier === "number" ? v.priceMultiplier : undefined,
          price: typeof v.price === "number" ? v.price : undefined,
          currency: typeof v.currency === "string" ? v.currency : undefined, // Variant pul birligi
          stock: typeof v.stock === "number" ? v.stock : undefined,
          status: typeof v.status === "string" ? v.status : undefined,
          imagePaths: Array.isArray(v.imagePaths) ? v.imagePaths : [],
        }))
      : [];

    const product = {
      id: idStr,
      name: doc.name ?? "",
      price: typeof doc.price === "number" ? doc.price : null,
      basePrice: typeof (doc as any).basePrice === "number" ? (doc as any).basePrice : null,
      priceMultiplier: typeof (doc as any).priceMultiplier === "number" ? (doc as any).priceMultiplier : null,
      currency: typeof (doc as any).currency === "string" ? (doc as any).currency : undefined, // Mahsulot pul birligi
      sku: doc.sku ?? "",
      categoryId: doc.categoryId ? doc.categoryId.toString?.() ?? null : null,
      stock: typeof doc.stock === "number" ? doc.stock : null,
      sizes: sizesFromVariants,
      variants: normalizedVariants,
      variantSummaries: normalizedVariantSummaries,
      imageUrl: imageUrl,
      imagePaths: imagePaths,
      video: videoData,
      store: doc.store ? doc.store.toString?.() ?? null : null,
      status: normalizeProductStatus((doc as any).status),
    };

    console.log('[api/products/:id] Returning product with variantSummaries:', {
      productId: idStr,
      variantSummariesCount: normalizedVariantSummaries.length,
      variantSummaries: normalizedVariantSummaries
    });

    return res.json({ success: true, product });
  } catch (err) {
    console.error("[api/products/:id] error", err);
    return res.status(500).json({ success: false, message: "Server xatosi" });
  }
};

export const handleProductsCreate: RequestHandler = async (req, res) => {
  try {
    console.log("[api/products POST] Starting product creation");
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      console.error("[api/products POST] MongoDB connection failed");
      return res.status(500).json({ success: false, message: "MongoDB ulanmagan" });
    }
    console.log("[api/products POST] MongoDB connected successfully");

    const { name, sku, price, basePrice, priceMultiplier, currency, categoryId, stock, imageBase64, imagesBase64, sizes, variants, variantSummaries, store, status, videoFilename, videoSize, videoBase64 } = req.body as {
      name?: string;
      sku?: string;
      price?: number;
      basePrice?: number;
      priceMultiplier?: number;
      currency?: string;
      categoryId?: string;
      stock?: number;
      imageBase64?: string;
      imagesBase64?: string[];
      sizes?: string;
      variants?: any;
      variantSummaries?: any[];
      store?: string;
      status?: string;
      videoFilename?: string;
      videoSize?: number;
      videoBase64?: string;
    };

    console.log('[api/products POST] Received data:', { 
      name, 
      sku, 
      price, 
      basePrice, 
      priceMultiplier, 
      currency,
      stock,
      isWPS: process.env.WPS_DEPLOY === 'true'
    });

    const cleanName = (name ?? "").toString().trim();
    const cleanSku = (sku ?? "").toString().trim();
    const cleanPrice = typeof price === "number" ? price : Number(price ?? 0) || 0;
    const cleanBasePrice = typeof basePrice === "number" ? basePrice : Number(basePrice ?? 0) || 0;
    const cleanPriceMultiplier = typeof priceMultiplier === "number" ? priceMultiplier : Number(priceMultiplier ?? 0) || 0;
    const cleanStock = typeof stock === "number" ? stock : Number(stock ?? 0) || 0;
    
    console.log('[api/products POST] Cleaned data:', { cleanPrice, cleanBasePrice, cleanPriceMultiplier });
    const cleanSizes = (sizes ?? "")
      .toString()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    let cleanVariants: ProductVariantDoc[] = [];
    if (variants !== undefined) {
      let raw: any = variants;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          raw = [];
        }
      }

      if (Array.isArray(raw)) {
        cleanVariants = raw
          .map((v) => {
            const name = (v?.name ?? "").toString().trim();
            const options = Array.isArray(v?.options)
              ? v.options.map((o: any) => o?.toString().trim()).filter(Boolean)
              : [];
            if (!name || options.length === 0) return null;
            return { name, options } as ProductVariantDoc;
          })
          .filter((v): v is ProductVariantDoc => Boolean(v));
      }
    }

    if (!cleanName || !cleanSku) {
      return res.status(400).json({ success: false, message: "Nom va SKU majburiy" });
    }

    const db = conn.db;
    const cleanStatus = normalizeProductStatus(typeof status === "string" ? status : undefined);

    const doc: any = {
      name: cleanName,
      sku: cleanSku,
      price: cleanPrice,
      basePrice: cleanBasePrice,
      priceMultiplier: cleanPriceMultiplier,
      currency: typeof currency === "string" ? currency : "UZS", // Pul birligini saqlash
      stock: cleanStock,
      status: cleanStatus,
    };
    
    console.log('[api/products POST] Document to save:', doc);

    if (cleanSizes.length > 0) {
      doc.sizes = cleanSizes;
    } else if (cleanVariants.length > 0) {
      const first = cleanVariants[0];
      if (first && Array.isArray(first.options) && first.options.length > 0) {
        doc.sizes = first.options;
      }
    }

    if (cleanVariants.length > 0) {
      doc.variants = cleanVariants;
    }

    // Process multiple images if provided (main product images)
    const imagePaths: string[] = [];
    const uploadsRoot = path.join(uploadsBase, "products");
    
    if (!fs.existsSync(uploadsRoot)) {
      try {
        fs.mkdirSync(uploadsRoot, { recursive: true });
        console.log("[api/products POST] Directory created successfully");
      } catch (mkdirErr) {
        console.error("[api/products POST] Failed to create directory:", mkdirErr);
      }
    }

    // Process multiple images if provided via base64
    if (Array.isArray(imagesBase64) && imagesBase64.length > 0) {
      console.log(`[api/products POST] Processing ${imagesBase64.length} images`);
      for (let i = 0; i < imagesBase64.length; i++) {
        const imgBase64 = imagesBase64[i];
        if (typeof imgBase64 === "string" && imgBase64.trim()) {
          try {
            const base64Data = imgBase64.includes(",") ? imgBase64.split(",")[1] : imgBase64;
            if (!base64Data || base64Data.trim().length === 0) continue;
            
            const originalBuffer = Buffer.from(base64Data, "base64");
            if (originalBuffer.length === 0) continue;
            
            const compressed = await compressImageToBuffer(originalBuffer);
            const fileName = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.webp`;
            const absPath = path.join(uploadsRoot, fileName);
            fs.writeFileSync(absPath, compressed);
            const publicPath = `/uploads/products/${fileName}`;
            imagePaths.push(publicPath);
            console.log(`[api/products POST] Image ${i + 1} saved: ${publicPath}`);
          } catch (e) {
            console.error(`[api/products POST] Failed to process image ${i + 1}:`, e);
          }
        }
      }
    } else if (typeof imageBase64 === "string" && imageBase64.trim()) {
      // Process single image (backward compatibility)
      try {
        console.log("[api/products POST] Processing single image");
        const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
        
        if (!base64Data || base64Data.trim().length === 0) {
          throw new Error("Base64 data is empty after parsing");
        }
        
        const originalBuffer = Buffer.from(base64Data, "base64");
        if (originalBuffer.length === 0) {
          throw new Error("Buffer is empty after decoding");
        }
        
        const compressed = await compressImageToBuffer(originalBuffer);
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
        const absPath = path.join(uploadsRoot, fileName);
        fs.writeFileSync(absPath, compressed);
        const publicPath = `/uploads/products/${fileName}`;
        imagePaths.push(publicPath);
        console.log("[api/products POST] Single image saved:", publicPath);
      } catch (e) {
        console.error("[api/products POST] failed to process imageBase64", e);
        return res.status(400).json({ success: false, message: `Image processing failed: ${e instanceof Error ? e.message : String(e)}` });
      }
    }

    // Allow client-provided imagePaths (uploaded via multipart before submit)
    const bodyImagePaths = Array.isArray((req.body as any).imagePaths) ? (req.body as any).imagePaths.filter((p: any) => typeof p === 'string' && p.trim()) : [];

    // Set imagePaths array and first image as imagePath for backward compatibility
    if (imagePaths.length > 0 || bodyImagePaths.length > 0) {
      const finalPaths = imagePaths.length > 0 ? imagePaths : bodyImagePaths;
      doc.imagePaths = finalPaths;
      doc.imagePath = finalPaths[0];
      doc.imageUrl = finalPaths[0];
      console.log(`[api/products POST] Total ${finalPaths.length} images saved (base64:${imagePaths.length} body:${bodyImagePaths.length})`);
    } else {
      console.log("[api/products POST] No images provided");
    }

    // Add variantSummaries if present (including images)
    if (Array.isArray(variantSummaries) && variantSummaries.length > 0) {
      const processedVariantSummaries: any[] = [];

      for (let i = 0; i < variantSummaries.length; i++) {
        const v: any = variantSummaries[i];
        const existingPaths = Array.isArray(v.imagePaths) ? v.imagePaths : [];
        const newPaths: string[] = [];

        // Process variant images if provided
        if (Array.isArray(v.imageBase64s) && v.imageBase64s.length > 0) {
          console.log(`[api/products POST] Processing ${v.imageBase64s.length} images for variant ${i}`);
          for (let j = 0; j < v.imageBase64s.length; j++) {
            const imgBase64 = v.imageBase64s[j];
            if (typeof imgBase64 === "string" && imgBase64.trim()) {
              try {
                const base64Data = imgBase64.includes(",") ? imgBase64.split(",")[1] : imgBase64;
                if (!base64Data || base64Data.trim().length === 0) continue;
                
                const originalBuffer = Buffer.from(base64Data, "base64");
                if (originalBuffer.length === 0) continue;
                
                const compressed = await compressImageToBuffer(originalBuffer);
                const fileName = `${Date.now()}-v${i}-${j}-${Math.random().toString(36).slice(2, 8)}.webp`;
                const absPath = path.join(uploadsRoot, fileName);
                fs.writeFileSync(absPath, compressed);
                const publicPath = `/uploads/products/${fileName}`;
                newPaths.push(publicPath);
                console.log(`[api/products POST] Variant ${i} image ${j + 1} saved: ${publicPath}`);
              } catch (e) {
                console.error(`[api/products POST] Failed to process variant ${i} image ${j + 1}:`, e);
              }
            }
          }
        }

        const variantData = {
          name: (v.name || '').toString().trim(),
          sku: typeof v.sku === 'string' ? v.sku.trim() : '', // SKU ni qo'shamiz
          basePrice: typeof v.basePrice === 'number' ? v.basePrice : (parseFloat(v.basePrice) || 0),
          priceMultiplier: typeof v.priceMultiplier === 'number' ? v.priceMultiplier : (parseFloat(v.priceMultiplier) || 0),
          price: typeof v.price === 'number' ? v.price : (parseFloat(v.price) || 0),
          currency: typeof v.currency === 'string' && v.currency ? v.currency : 'UZS', // Variant pul birligini majburiy tekshirish
          stock: typeof v.stock === 'number' ? v.stock : (parseInt(v.stock) || 0),
          status: typeof v.status === 'string' ? v.status : 'available',
          imagePaths: [...existingPaths, ...newPaths],
        };
        
        console.log(`[api/products POST] Variant ${i} data:`, {
          name: variantData.name,
          sku: variantData.sku,
          basePrice: variantData.basePrice,
          priceMultiplier: variantData.priceMultiplier,
          price: variantData.price,
          currency: variantData.currency,
          stock: variantData.stock,
          imagePathsCount: variantData.imagePaths.length
        });
        
        processedVariantSummaries.push(variantData);
      }

      doc.variantSummaries = processedVariantSummaries;
      console.log('[api/products POST] Added variantSummaries:', doc.variantSummaries);
    }


    if (categoryId) {
      try {
        doc.categoryId = new ObjectId(categoryId);
      } catch {
        doc.categoryId = categoryId;
      }
    }

    if (store) {
      try {
        doc.store = new ObjectId(store);
      } catch {
        doc.store = store;
      }
    }

    if (videoFilename && typeof videoFilename === "string" && videoFilename.trim()) {
      const videoData: any = {
        filename: videoFilename.trim(),
        size: typeof videoSize === "number" ? videoSize : undefined,
      };

      if (typeof videoBase64 === "string" && videoBase64.trim()) {
        try {
          const base64Data = videoBase64.includes(",") ? videoBase64.split(",")[1] : videoBase64;
          const videoBuffer = Buffer.from(base64Data, "base64");
          const ext = videoFilename.split('.').pop() || 'mp4';
          const contentType = `video/${ext === 'mp4' ? 'mp4' : ext === 'webm' ? 'webm' : 'mp4'}`;
          const gridfsId = await saveVideoToGridFS(videoBuffer, videoFilename.trim(), contentType);
          videoData.gridfsId = gridfsId;
        } catch (e) {
          console.error("[api/products POST] failed to save video to GridFS", e);
        }
      }

      doc.video = videoData;
    }

    console.log("[api/products POST] Inserting document into database:", { 
      name: doc.name, 
      sku: doc.sku, 
      hasImage: !!doc.imagePath, 
      hasVariantSummaries: !!doc.variantSummaries, 
      variantSummariesCount: Array.isArray(doc.variantSummaries) ? doc.variantSummaries.length : 0,
      currency: doc.currency,
      isWPS: process.env.WPS_DEPLOY === 'true'
    });
    
    // MongoDB ga saqlashdan oldin variantSummaries ni tekshirish
    if (Array.isArray(doc.variantSummaries) && doc.variantSummaries.length > 0) {
      console.log('[api/products POST] VariantSummaries before insert:', doc.variantSummaries.map(v => ({ name: v.name, currency: v.currency, price: v.price })));
    }
    
    const result = await db.collection(PRODUCTS_COLLECTION).insertOne(doc);
    console.log("[api/products POST] Document inserted successfully with ID:", result.insertedId);

    let finalVideo = doc.video;
    if (doc.video && (doc.video as any).gridfsId) {
      const videoUrl = `/api/products/${result.insertedId}/video`;
      await db.collection(PRODUCTS_COLLECTION).updateOne(
        { _id: result.insertedId },
        { $set: { "video.url": videoUrl } }
      );
      finalVideo = { ...doc.video, url: videoUrl } as any;
    }

    try {
      await db.collection(MAIN_PRODUCTS_COLLECTION).insertOne({
        _id: result.insertedId,
        ...doc,
        video: finalVideo,
      });
    } catch (copyErr) {
      console.error("[api/products POST] failed to mirror to products collection", copyErr);
    }

    const createdId = result.insertedId.toString();
    const created = {
      id: createdId,
      name: doc.name,
      price: doc.price,
      basePrice: typeof doc.basePrice === "number" ? doc.basePrice : null,
      priceMultiplier: typeof doc.priceMultiplier === "number" ? doc.priceMultiplier : null,
      currency: typeof doc.currency === "string" ? doc.currency : undefined, // Mahsulot pul birligi
      sku: doc.sku,
      categoryId: doc.categoryId ? doc.categoryId.toString?.() ?? null : null,
      stock: typeof doc.stock === "number" ? doc.stock : null,
      sizes: Array.isArray(doc.sizes) ? doc.sizes : [],
      variants: Array.isArray(doc.variants)
        ? doc.variants.map((v: ProductVariantDoc) => ({
            name: (v.name ?? "").toString().trim(),
            options: Array.isArray(v.options)
              ? v.options.map((o) => o?.toString().trim()).filter(Boolean)
              : [],
          }))
        : [],
      variantSummaries: Array.isArray(doc.variantSummaries) ? doc.variantSummaries : [],
      imageUrl: (doc as any).imageUrl || doc.imagePath || null,
      imagePaths: Array.isArray(doc.imagePaths) ? doc.imagePaths : [],
      video: finalVideo || null,
      store: doc.store ? doc.store.toString?.() ?? null : null,
      status: cleanStatus,
    };

    // Created obyektidagi variantSummaries ni tekshirish
    console.log('[api/products POST] Created object variantSummaries:', {
      hasVariantSummaries: !!created.variantSummaries,
      count: Array.isArray(created.variantSummaries) ? created.variantSummaries.length : 0,
      variantSummaries: created.variantSummaries
    });

    return res.status(201).json({ success: true, product: created });
  } catch (err) {
    console.error("[api/products POST] error", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, message: `Server xatosi: ${errorMsg}` });
  }
};

export const handleProductUpdate: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, message: "MongoDB ulanmagan" });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "ID kerak" });
    }

    const { name, sku, price, basePrice, priceMultiplier, currency, stock, categoryId, imageBase64, imagesBase64, sizes, variants, variantSummaries, store, status, videoFilename, videoSize, videoBase64 } = req.body as {
      name?: string;
      sku?: string;
      price?: number;
      basePrice?: number;
      priceMultiplier?: number;
      currency?: string;
      stock?: number;
      categoryId?: string;
      imageBase64?: string;
      imagesBase64?: string[];
      sizes?: string;
      variants?: any;
      variantSummaries?: any[];
      store?: string;
      status?: string;
      videoFilename?: string;
      videoSize?: number;
      videoBase64?: string;
    };

    console.log('[api/products PUT] Received data:', { name, sku, price, basePrice, priceMultiplier, currency, stock });

    const update: any = {};
    if (typeof name === "string") update.name = name.trim();
    if (typeof sku === "string") update.sku = sku.trim();
    if (price !== undefined) update.price = typeof price === "number" ? price : Number(price ?? 0) || 0;
    if (basePrice !== undefined) update.basePrice = typeof basePrice === "number" ? basePrice : Number(basePrice ?? 0) || 0;
    if (priceMultiplier !== undefined) update.priceMultiplier = typeof priceMultiplier === "number" ? priceMultiplier : Number(priceMultiplier ?? 0) || 0;
    if (currency !== undefined) update.currency = typeof currency === "string" && currency ? currency : "UZS"; // Pul birligini majburiy tekshirish
    if (stock !== undefined) update.stock = typeof stock === "number" ? stock : Number(stock ?? 0) || 0;
    
    console.log('[api/products PUT] Update object:', { price: update.price, basePrice: update.basePrice, priceMultiplier: update.priceMultiplier });

    const db = conn.db;

    // Query ni oldinroq yaratish (rasmlarni o'chirish uchun kerak)
    let query: any;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      query = { _id: id };
    }

    // Process multiple images if provided (main product images)
    const newImagePaths: string[] = [];
    const uploadsRoot = path.join(uploadsBase, "products");
    
    if (!fs.existsSync(uploadsRoot)) {
      try {
        fs.mkdirSync(uploadsRoot, { recursive: true });
        console.log("[api/products PUT] Directory created successfully");
      } catch (mkdirErr) {
        console.error("[api/products PUT] Failed to create directory:", mkdirErr);
      }
    }

    // Process multiple images if provided via base64
    if (Array.isArray(imagesBase64) && imagesBase64.length > 0) {
      console.log(`[api/products PUT] Processing ${imagesBase64.length} images`);
      for (let i = 0; i < imagesBase64.length; i++) {
        const imgBase64 = imagesBase64[i];
        if (typeof imgBase64 === "string" && imgBase64.trim()) {
          try {
            const base64Data = imgBase64.includes(",") ? imgBase64.split(",")[1] : imgBase64;
            if (!base64Data || base64Data.trim().length === 0) continue;
            
            const originalBuffer = Buffer.from(base64Data, "base64");
            if (originalBuffer.length === 0) continue;
            
            const compressed = await compressImageToBuffer(originalBuffer);
            const fileName = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.webp`;
            const absPath = path.join(uploadsRoot, fileName);
            fs.writeFileSync(absPath, compressed);
            const publicPath = `/uploads/products/${fileName}`;
            newImagePaths.push(publicPath);
            console.log(`[api/products PUT] Image ${i + 1} saved: ${publicPath}`);
          } catch (e) {
            console.error(`[api/products PUT] Failed to process image ${i + 1}:`, e);
          }
        }
      }
    } else if (typeof imageBase64 === "string" && imageBase64.trim()) {
      // Process single image (backward compatibility)
      try {
        console.log("[api/products PUT] Processing single image");
        const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
        
        if (!base64Data || base64Data.trim().length === 0) {
          throw new Error("Base64 data is empty after parsing");
        }
        
        const originalBuffer = Buffer.from(base64Data, "base64");
        if (originalBuffer.length === 0) {
          throw new Error("Buffer is empty after decoding");
        }
        
        const compressed = await compressImageToBuffer(originalBuffer);
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
        const absPath = path.join(uploadsRoot, fileName);
        fs.writeFileSync(absPath, compressed);
        const publicPath = `/uploads/products/${fileName}`;
        newImagePaths.push(publicPath);
        console.log("[api/products PUT] Single image saved:", publicPath);
      } catch (e) {
        console.error("[api/products PUT] failed to process imageBase64", e);
        return res.status(400).json({ success: false, message: `Image processing failed: ${e instanceof Error ? e.message : String(e)}` });
      }
    }

    // Allow client-provided imagePaths (uploaded via multipart before submit)
    const bodyImagePaths = Array.isArray((req.body as any).imagePaths) ? (req.body as any).imagePaths.filter((p: any) => typeof p === 'string' && p.trim()) : [];

    // Set imagePaths array and first image as imagePath for backward compatibility
    if (newImagePaths.length > 0 || bodyImagePaths.length > 0) {
      const existingDoc = await db.collection(PRODUCTS_COLLECTION).findOne(query);
      const existingPathsRaw = Array.isArray((existingDoc as any)?.imagePaths) ? (existingDoc as any).imagePaths : [];
      const singleExisting = (existingDoc as any)?.imageUrl || (existingDoc as any)?.imagePath || null;
      const existingPaths = existingPathsRaw.length > 0 ? existingPathsRaw : (singleExisting ? [singleExisting] : []);

      const allImagePaths = [...existingPaths, ...(newImagePaths.length > 0 ? newImagePaths : bodyImagePaths)];

      update.imagePaths = allImagePaths;
      update.imagePath = allImagePaths[0];
      update.imageUrl = allImagePaths[0];
      console.log(`[api/products PUT] Total ${allImagePaths.length} images (${existingPaths.length} existing + ${newImagePaths.length} new + ${bodyImagePaths.length} body)`);
    }

    // Update variantSummaries if provided (including images)
    if (Array.isArray(variantSummaries) && variantSummaries.length > 0) {
      const processedVariantSummaries: any[] = [];

      for (let i = 0; i < variantSummaries.length; i++) {
        const v: any = variantSummaries[i];
        const existingPaths = Array.isArray(v.imagePaths) ? v.imagePaths : [];
        const newPaths: string[] = [];

        // Process variant images if provided
        if (Array.isArray(v.imageBase64s) && v.imageBase64s.length > 0) {
          console.log(`[api/products PUT] Processing ${v.imageBase64s.length} images for variant ${i}`);
          for (let j = 0; j < v.imageBase64s.length; j++) {
            const imgBase64 = v.imageBase64s[j];
            if (typeof imgBase64 === "string" && imgBase64.trim()) {
              try {
                const base64Data = imgBase64.includes(",") ? imgBase64.split(",")[1] : imgBase64;
                if (!base64Data || base64Data.trim().length === 0) continue;
                
                const originalBuffer = Buffer.from(base64Data, "base64");
                if (originalBuffer.length === 0) continue;
                
                const compressed = await compressImageToBuffer(originalBuffer);
                const fileName = `${Date.now()}-v${i}-${j}-${Math.random().toString(36).slice(2, 8)}.webp`;
                const absPath = path.join(uploadsRoot, fileName);
                fs.writeFileSync(absPath, compressed);
                const publicPath = `/uploads/products/${fileName}`;
                newPaths.push(publicPath);
                console.log(`[api/products PUT] Variant ${i} image ${j + 1} saved: ${publicPath}`);
              } catch (e) {
                console.error(`[api/products PUT] Failed to process variant ${i} image ${j + 1}:`, e);
              }
            }
          }
        }

        const variantData = {
          name: (v.name || '').toString().trim(),
          sku: typeof v.sku === 'string' ? v.sku.trim() : '',
          basePrice: typeof v.basePrice === 'number' ? v.basePrice : (parseFloat(v.basePrice) || 0),
          priceMultiplier: typeof v.priceMultiplier === 'number' ? v.priceMultiplier : (parseFloat(v.priceMultiplier) || 0),
          price: typeof v.price === 'number' ? v.price : (parseFloat(v.price) || 0),
          currency: typeof v.currency === 'string' && v.currency ? v.currency : 'UZS',
          stock: typeof v.stock === 'number' ? v.stock : (parseInt(v.stock) || 0),
          status: typeof v.status === 'string' ? v.status : 'available',
          imagePaths: [...existingPaths, ...newPaths],
        };
        
        console.log(`[api/products PUT] Variant ${i} data:`, {
          name: variantData.name,
          sku: variantData.sku,
          basePrice: variantData.basePrice,
          priceMultiplier: variantData.priceMultiplier,
          price: variantData.price,
          currency: variantData.currency,
          stock: variantData.stock,
          imagePathsCount: variantData.imagePaths.length
        });
        
        processedVariantSummaries.push(variantData);
      }

      update.variantSummaries = processedVariantSummaries;
      console.log('[api/products PUT] Updated variantSummaries:', update.variantSummaries);
    }

    

    if (categoryId !== undefined) {
      if (!categoryId) {
        update.categoryId = null;
      } else {
        try {
          update.categoryId = new ObjectId(categoryId);
        } catch {
          update.categoryId = categoryId;
        }
      }
    }

    if (store !== undefined) {
      if (!store) {
        update.store = null;
      } else {
        try {
          update.store = new ObjectId(store);
        } catch {
          update.store = store;
        }
      }
    }

    if (status !== undefined) {
      update.status = normalizeProductStatus(typeof status === "string" ? status : undefined);
    }

    if (sizes !== undefined) {
      const parsed = sizes
        ?.toString()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
      update.sizes = parsed;
    }

    if (variants !== undefined) {
      let raw: any = variants;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          raw = [];
        }
      }

      if (Array.isArray(raw)) {
        const cleanVariants: ProductVariantDoc[] = raw
          .map((v) => {
            const name = (v?.name ?? "").toString().trim();
            const options = Array.isArray(v?.options)
              ? v.options.map((o: any) => o?.toString().trim()).filter(Boolean)
              : [];
            if (!name || options.length === 0) return null;
            return { name, options } as ProductVariantDoc;
          })
          .filter((v): v is ProductVariantDoc => Boolean(v));

        update.variants = cleanVariants;
      } else {
        update.variants = [];
      }
    }

    // Add variantSummaries if present
    if (variantSummaries !== undefined && update.variantSummaries === undefined) {
      if (Array.isArray(variantSummaries) && variantSummaries.length > 0) {
        update.variantSummaries = variantSummaries.map((v: any) => ({
          name: (v.name || '').toString().trim(),
          sku: typeof v.sku === 'string' ? v.sku.trim() : '', // SKU ni qo'shamiz
          basePrice: typeof v.basePrice === 'number' ? v.basePrice : 0,
          priceMultiplier: typeof v.priceMultiplier === 'number' ? v.priceMultiplier : 0,
          price: typeof v.price === 'number' ? v.price : 0,
          currency: typeof v.currency === 'string' && v.currency ? v.currency : 'UZS', // Pul birligini majburiy qo'shish
          stock: typeof v.stock === 'number' ? v.stock : 0,
          status: typeof v.status === 'string' ? v.status : 'available',
          imagePaths: Array.isArray(v.imagePaths) ? v.imagePaths : [],
        }));
        console.log('[api/products PUT] Updated variantSummaries:', update.variantSummaries);
      } else {
        update.variantSummaries = [];
      }
    }

    let updatedVideoData: any | null = null;
    if (videoFilename !== undefined) {
      if (typeof videoFilename === "string" && videoFilename.trim()) {
        const videoData: any = {
          filename: videoFilename.trim(),
          size: typeof videoSize === "number" ? videoSize : undefined,
        };

        const existingDoc = await db.collection(PRODUCTS_COLLECTION).findOne(query);
        if (existingDoc && (existingDoc as any).video && (existingDoc as any).video.gridfsId) {
          try {
            await deleteVideoFromGridFS((existingDoc as any).video.gridfsId);
          } catch (e) {
            console.error("[api/products PUT] failed to delete old video from GridFS", e);
          }
        }

        if (typeof videoBase64 === "string" && videoBase64.trim()) {
          try {
            const base64Data = videoBase64.includes(",") ? videoBase64.split(",")[1] : videoBase64;
            const videoBuffer = Buffer.from(base64Data, "base64");
            const ext = videoFilename.split('.').pop() || 'mp4';
            const contentType = `video/${ext === 'mp4' ? 'mp4' : ext === 'webm' ? 'webm' : 'mp4'}`;
            const gridfsId = await saveVideoToGridFS(videoBuffer, videoFilename.trim(), contentType);
            videoData.gridfsId = gridfsId;
            videoData.url = `/api/products/${id}/video`;
          } catch (e) {
            console.error("[api/products PUT] failed to save video to GridFS", e);
          }
        }

        update.video = videoData;
        updatedVideoData = videoData;
      } else {
        const existingDoc = await db.collection(PRODUCTS_COLLECTION).findOne(query);
        if (existingDoc && (existingDoc as any).video && (existingDoc as any).video.gridfsId) {
          try {
            await deleteVideoFromGridFS((existingDoc as any).video.gridfsId);
          } catch (e) {
            console.error("[api/products PUT] failed to delete video from GridFS", e);
          }
        }
        update.video = null;
        updatedVideoData = null;
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: "Yangilash uchun maydon yo'q" });
    }

    const result = await db.collection(PRODUCTS_COLLECTION).findOneAndUpdate(
      query,
      { $set: update },
      { returnDocument: "after", upsert: true },
    );

    let doc = result.value as ProductDoc | null;

    if (!doc) {
      doc = (await db.collection(PRODUCTS_COLLECTION).findOne(query)) as ProductDoc | null;
    }

    // MAIN_PRODUCTS_COLLECTION'ni ham yangilash (rasmlar bilan birga)
    try {
      await db.collection(MAIN_PRODUCTS_COLLECTION).updateOne(query, { $set: update }, { upsert: true });
      console.log("[api/products PUT] Successfully updated MAIN_PRODUCTS_COLLECTION with new images");
    } catch (copyErr) {
      console.error("[api/products PUT] failed to mirror to products collection", copyErr);
    }

    if (!doc) {
      return res.status(500).json({ success: false, message: "Mahsulotni yangilash imkoni bo'lmadi" });
    }

    const idStr = doc._id?.toString?.() ?? "";

    const normalizedVariants = Array.isArray(doc.variants)
      ? doc.variants.map((v: ProductVariantDoc) => ({
          name: (v.name ?? "").toString().trim(),
          options: Array.isArray(v.options)
            ? v.options.map((o) => o?.toString().trim()).filter(Boolean)
            : [],
        }))
      : [];

    const normalizedSizes = Array.isArray(doc.sizes) ? doc.sizes : [];
    const sizesFromVariants =
      !normalizedSizes.length && normalizedVariants.length && normalizedVariants[0].options.length
        ? normalizedVariants[0].options
        : normalizedSizes;

    // Image paths - yangilangan rasmlar yoki mavjud rasmlar
    const finalImageUrl = (doc as any).imageUrl || doc.imagePath || null;
    const finalImagePaths = Array.isArray((doc as any).imagePaths) && (doc as any).imagePaths.length > 0 
      ? (doc as any).imagePaths 
      : (finalImageUrl ? [finalImageUrl] : []);

    // Parse variantSummaries if present
    const normalizedVariantSummaries = Array.isArray((doc as any).variantSummaries)
      ? (doc as any).variantSummaries.map((v: VariantSummaryDoc) => ({
          name: (v.name ?? "").toString().trim(),
          sku: typeof v.sku === "string" ? v.sku.trim() : undefined,
          basePrice: typeof v.basePrice === "number" ? v.basePrice : undefined,
          priceMultiplier: typeof v.priceMultiplier === "number" ? v.priceMultiplier : undefined,
          price: typeof v.price === "number" ? v.price : undefined,
          currency: typeof v.currency === "string" ? v.currency : undefined,
          stock: typeof v.stock === "number" ? v.stock : undefined,
          status: typeof v.status === "string" ? v.status : undefined,
          imagePaths: Array.isArray(v.imagePaths) ? v.imagePaths : [],
        }))
      : [];

    const product = {
      id: idStr,
      name: doc.name ?? "",
      price: typeof doc.price === "number" ? doc.price : null,
      basePrice: typeof (doc as any).basePrice === "number" ? (doc as any).basePrice : null,
      priceMultiplier: typeof (doc as any).priceMultiplier === "number" ? (doc as any).priceMultiplier : null,
      currency: typeof (doc as any).currency === "string" ? (doc as any).currency : undefined, // Mahsulot pul birligi
      sku: doc.sku ?? "",
      categoryId: doc.categoryId ? doc.categoryId.toString?.() ?? null : null,
      stock: typeof doc.stock === "number" ? doc.stock : null,
      sizes: sizesFromVariants,
      variants: normalizedVariants,
      variantSummaries: normalizedVariantSummaries,
      imageUrl: finalImageUrl,
      imagePaths: finalImagePaths, // Yangilangan rasmlar
      video: updatedVideoData ?? (doc as any).video ?? null,
      store: doc.store ? doc.store.toString?.() ?? null : null,
      status: normalizeProductStatus((doc as any).status),
    };

    return res.json({ success: true, product });
  } catch (err) {
    console.error("[api/products PUT] error", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, message: `Server xatosi: ${errorMsg}` });
  }
};

export const handleProductDelete: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, message: "MongoDB ulanmagan" });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "ID kerak" });
    }

    const db = conn.db;

    let query: any;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      query = { _id: id };
    }

    const doc = await db.collection(PRODUCTS_COLLECTION).findOne(query);
    if (doc && (doc as any).video && (doc as any).video.gridfsId) {
      try {
        await deleteVideoFromGridFS((doc as any).video.gridfsId);
      } catch (videoErr) {
        console.error("[api/products DELETE] failed to delete video from GridFS", videoErr);
      }
    }

    const result = await db.collection(PRODUCTS_COLLECTION).deleteOne(query);
    if (!result.deletedCount) {
      return res.status(404).json({ success: false, message: "Mahsulot topilmadi" });
    }

    try {
      await db.collection(MAIN_PRODUCTS_COLLECTION).deleteOne(query);
    } catch (copyErr) {
      console.error("[api/products DELETE] failed to mirror delete to products collection", copyErr);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[api/products DELETE] error", err);
    return res.status(500).json({ success: false, message: "Server xatosi" });
  }
};

export const handleProductVideoGet: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn) {
      return res.status(500).send("MongoDB ulanmagan");
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).send("ID kerak");
    }

    const db = conn.db;

    let query: any;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      query = { _id: id };
    }

    const doc = (await db.collection(PRODUCTS_COLLECTION).findOne(query)) as ProductDoc | null;
    if (!doc || !doc.video || !(doc.video as any).gridfsId) {
      return res.status(404).send("Video topilmadi");
    }

    const videoGridfsId = (doc.video as any).gridfsId;
    const videoStream = await getVideoFromGridFS(videoGridfsId);

    if (!videoStream) {
      return res.status(404).send("Video fayl topilmadi");
    }

    const filename = (doc.video as any).filename || "video.mp4";
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    videoStream.pipe(res);
  } catch (error) {
    console.error("[api/products/:id/video GET] error:", error);
    return res.status(500).send("Server xatosi");
  }
};

export const handleProductImageGet: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn) {
      return res.status(500).send("MongoDB ulanmagan");
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).send("ID kerak");
    }

    const db = conn.db;

    let query: any;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      query = { _id: id };
    }

    const doc = (await db.collection(PRODUCTS_COLLECTION).findOne(query)) as ProductDoc | null;
    if (!doc || !doc.imagePath) {
      return res.status(404).send("Rasm topilmadi");
    }

    // Resolve path inside uploads directory. doc.imagePath is like /uploads/products/<file>
    const relative = doc.imagePath.replace(/^\/+/, "").replace(/^uploads[\\/]/, "");
    const absPath = path.join(uploadsBase, relative);

    if (!fs.existsSync(absPath)) {
      return res.status(404).send("Rasm topilmadi");
    }

    res.setHeader("Content-Type", "image/webp");
    return res.sendFile(absPath);
  } catch (err) {
    console.error("[api/products/:id/image] error", err);
    return res.status(500).send("Server xatosi");
  }
};

export const productImageUploadMiddleware = multer({ storage: multer.memoryStorage() }).single("image");

export const handleProductImageUpload: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, message: "MongoDB ulanmagan" });
    }

    const { id } = req.params as { id: string };
    if (!id) {
      return res.status(400).json({ success: false, message: "ID kerak" });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file || !file.buffer || file.size === 0) {
      return res.status(400).json({ success: false, message: "Rasm fayli kerak" });
    }

    const uploadsRoot = path.join(uploadsBase, "products");
    if (!fs.existsSync(uploadsRoot)) {
      fs.mkdirSync(uploadsRoot, { recursive: true });
    }

    const safeName = (file.originalname || "image").replace(/[^a-z0-9\.-_]/gi, "_");
    const base = path.parse(safeName).name;
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}.webp`;
    const absPath = path.join(uploadsRoot, fileName);
    await sharp(file.buffer, { sequentialRead: true })
      .rotate()
      .resize({ width: 1500, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(absPath);
    const publicPath = `/uploads/products/${fileName}`;

    const db = conn.db;
    let query: any;
    try {
      query = { _id: new mongoose.Types.ObjectId(id) };
    } catch {
      query = { _id: id };
    }

    const update = { imagePath: publicPath, imagePaths: [publicPath] } as any;
    await db.collection(process.env.OFFLINE_PRODUCTS_COLLECTION || "products").updateOne(query, { $set: update }, { upsert: true });
    await db.collection("products").updateOne(query, { $set: update }, { upsert: true });

    return res.json({ success: true, url: publicPath });
  } catch (err) {
    return res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) });
  }
};

export const processProductImageUpload: RequestHandler = async (req, res, next) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file || !file.buffer || file.size === 0) {
      return res.status(400).json({ success: false, error: "No image file provided" });
    }

    // Accept common image formats including HEIC/HEIF
    const mimetype = file.mimetype || "";
    const allowed = new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ]);
    const isValidType = allowed.has(mimetype) ||
                       /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.originalname || "");
    
    if (!isValidType) {
      return res.status(400).json({ 
        success: false, 
        error: "Only JPEG, PNG, WebP, or HEIC images are allowed" 
      });
    }

    // Ensure uploads directory exists
    const uploadsRoot = path.join(uploadsBase, "products");
    if (!fs.existsSync(uploadsRoot)) {
      try {
        fs.mkdirSync(uploadsRoot, { recursive: true });
      } catch (mkdirErr) {
        console.error("[processProductImageUpload] Failed to create directory:", mkdirErr);
        return res.status(500).json({ 
          success: false, 
          error: "Failed to create upload directory" 
        });
      }
    }

    // Configure Sharp for optimal performance
    sharp.cache(false);
    sharp.concurrency(2);

    // Generate unique filename
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
    const absPath = path.join(uploadsRoot, name);

    try {
      // Process image with Sharp
      // This handles HEIC/HEIF conversion, rotation, resizing, and WebP conversion
      await sharp(file.buffer, { 
        sequentialRead: true,
        failOn: 'none', // Don't fail on invalid metadata
      })
        .rotate() // Auto-rotate based on EXIF
        .resize({ 
          width: 1500, 
          withoutEnlargement: true, // Don't upscale small images
          fit: 'inside', // Maintain aspect ratio
        })
        .webp({ 
          quality: 80,
          effort: 4, // Balance between compression and speed
        })
        .toFile(absPath);

      // Clean up memory and store relative path for later response
      (req as any).processedImagePath = `/uploads/products/${name}`;
      (req as any).file.buffer = undefined;
      (req as any).file = undefined;

      next();
    } catch (sharpError) {
      console.error("[processProductImageUpload] Sharp processing error:", sharpError);
      return res.status(500).json({ 
        success: false, 
        error: "Failed to process image. Please try a different image." 
      });
    }
  } catch (err) {
    console.error("[processProductImageUpload] Unexpected error:", err);
    next(err);
  }
};

export const respondProcessedImage: RequestHandler = (req, res) => {
  const processedPath = (req as any).processedImagePath as string | undefined;
  if (!processedPath) {
    return res.status(500).json({
      success: false,
      error: "Image processing failed",
    });
  }

  // Map physical/relative path ("/uploads/products/...") to public API path ("/api/uploads/products/...")
  const apiPath = processedPath.replace(/^\/+uploads/, "/api/uploads");

  // Allow overriding public base URL from env (for example, always https://shop.avtofix.uz)
  const envBase = process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim();
  const base = envBase || `${req.protocol}://${req.get("host")}`;
  const normalizedBase = base.replace(/\/+$/, "");

  const fullUrl = `${normalizedBase}${apiPath}`;

  return res.json({ success: true, url: fullUrl });
};

export const handleProductVariantImageUpload: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, message: "MongoDB ulanmagan" });
    }

    const { id, index } = req.params as { id: string; index: string };
    const variantIndex = Number(index);
    if (!id || !Number.isFinite(variantIndex) || variantIndex < 0) {
      return res.status(400).json({ success: false, message: "ID va variant indeksi kerak" });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file || !file.buffer || file.size === 0) {
      return res.status(400).json({ success: false, message: "Rasm fayli kerak" });
    }

    const uploadsRoot = path.join(uploadsBase, "products");
    if (!fs.existsSync(uploadsRoot)) {
      fs.mkdirSync(uploadsRoot, { recursive: true });
    }

    const safeName = (file.originalname || "variant").replace(/[^a-z0-9\.-_]/gi, "_");
    const base = path.parse(safeName).name;
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-v${variantIndex}-${base}.webp`;
    const absPath = path.join(uploadsRoot, fileName);
    await sharp(file.buffer, { sequentialRead: true })
      .rotate()
      .resize({ width: 1500, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(absPath);
    const publicPath = `/uploads/products/${fileName}`;

    const db = conn.db;
    let query: any;
    try {
      query = { _id: new mongoose.Types.ObjectId(id) };
    } catch {
      query = { _id: id };
    }

    const doc = (await db.collection(PRODUCTS_COLLECTION).findOne(query)) as ProductDoc | null;
    const fallbackDoc = !doc
      ? ((await db.collection(MAIN_PRODUCTS_COLLECTION).findOne(query)) as ProductDoc | null)
      : null;
    const sourceDoc = doc || fallbackDoc;
    if (!sourceDoc) {
      return res.status(404).json({ success: false, message: "Mahsulot topilmadi" });
    }

    const variantSummaries = Array.isArray((sourceDoc as any).variantSummaries)
      ? [...(sourceDoc as any).variantSummaries]
      : [];
    while (variantSummaries.length <= variantIndex) {
      variantSummaries.push({ name: "", imagePaths: [] });
    }
    const target = variantSummaries[variantIndex] || { name: "", imagePaths: [] };
    const paths = Array.isArray((target as any).imagePaths)
      ? [...(target as any).imagePaths]
      : [];
    paths.push(publicPath);
    variantSummaries[variantIndex] = { ...target, imagePaths: paths };

    await db.collection(PRODUCTS_COLLECTION).updateOne(
      query,
      { $set: { variantSummaries } },
      { upsert: true },
    );
    await db.collection(MAIN_PRODUCTS_COLLECTION).updateOne(
      query,
      { $set: { variantSummaries } },
      { upsert: true },
    );

    return res.json({ success: true, url: publicPath, index: variantIndex });
  } catch (err) {
    console.error("[api/products/:id/variant/:index/image] error", err);
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

/**
 * Delete a specific product image by index
 * DELETE /api/products/:id/images/:imageIndex
 */
export const handleProductImageDelete: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, message: "MongoDB ulanmagan" });
    }

    const { id, imageIndex } = req.params as { id: string; imageIndex: string };
    const index = parseInt(imageIndex, 10);

    if (!id || !Number.isFinite(index) || index < 0) {
      return res.status(400).json({ success: false, message: "ID va rasm indeksi kerak" });
    }

    const db = conn.db;
    let query: any;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      query = { _id: id };
    }

    const doc = (await db.collection(PRODUCTS_COLLECTION).findOne(query)) as ProductDoc | null;
    if (!doc) {
      return res.status(404).json({ success: false, message: "Mahsulot topilmadi" });
    }

    const imagePaths = Array.isArray((doc as any).imagePaths) ? [...(doc as any).imagePaths] : [];
    
    if (index >= imagePaths.length) {
      return res.status(404).json({ success: false, message: "Rasm topilmadi" });
    }

    const imageToDelete = imagePaths[index];
    
    // Delete physical file
    if (imageToDelete) {
      try {
        const relative = imageToDelete.replace(/^\/+/, "").replace(/^uploads[\\/]/, "");
        const absPath = path.join(uploadsBase, relative);
        if (fs.existsSync(absPath)) {
          fs.unlinkSync(absPath);
          console.log(`[handleProductImageDelete] Deleted file: ${absPath}`);
        }
      } catch (fileErr) {
        console.error("[handleProductImageDelete] Failed to delete file:", fileErr);
      }
    }

    // Remove from array
    imagePaths.splice(index, 1);

    // Update database
    const update: any = { imagePaths };
    
    // Update imagePath and imageUrl to first remaining image or null
    if (imagePaths.length > 0) {
      update.imagePath = imagePaths[0];
      update.imageUrl = imagePaths[0];
    } else {
      update.imagePath = null;
      update.imageUrl = null;
    }

    await db.collection(PRODUCTS_COLLECTION).updateOne(query, { $set: update });
    await db.collection(MAIN_PRODUCTS_COLLECTION).updateOne(query, { $set: update });

    return res.json({ success: true, imagePaths });
  } catch (err) {
    console.error("[handleProductImageDelete] error", err);
    return res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * Delete a specific variant image by index
 * DELETE /api/products/:id/variants/:variantIndex/images/:imageIndex
 */
export const handleVariantImageDelete: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, message: "MongoDB ulanmagan" });
    }

    const { id, variantIndex, imageIndex } = req.params as { id: string; variantIndex: string; imageIndex: string };
    const vIndex = parseInt(variantIndex, 10);
    const iIndex = parseInt(imageIndex, 10);

    if (!id || !Number.isFinite(vIndex) || vIndex < 0 || !Number.isFinite(iIndex) || iIndex < 0) {
      return res.status(400).json({ success: false, message: "ID, variant indeksi va rasm indeksi kerak" });
    }

    const db = conn.db;
    let query: any;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      query = { _id: id };
    }

    const doc = (await db.collection(PRODUCTS_COLLECTION).findOne(query)) as ProductDoc | null;
    if (!doc) {
      return res.status(404).json({ success: false, message: "Mahsulot topilmadi" });
    }

    const variantSummaries = Array.isArray((doc as any).variantSummaries) ? [...(doc as any).variantSummaries] : [];
    
    if (vIndex >= variantSummaries.length) {
      return res.status(404).json({ success: false, message: "Variant topilmadi" });
    }

    const variant = variantSummaries[vIndex];
    const imagePaths = Array.isArray(variant.imagePaths) ? [...variant.imagePaths] : [];

    if (iIndex >= imagePaths.length) {
      return res.status(404).json({ success: false, message: "Rasm topilmadi" });
    }

    const imageToDelete = imagePaths[iIndex];

    // Delete physical file
    if (imageToDelete) {
      try {
        const relative = imageToDelete.replace(/^\/+/, "").replace(/^uploads[\\/]/, "");
        const absPath = path.join(uploadsBase, relative);
        if (fs.existsSync(absPath)) {
          fs.unlinkSync(absPath);
          console.log(`[handleVariantImageDelete] Deleted file: ${absPath}`);
        }
      } catch (fileErr) {
        console.error("[handleVariantImageDelete] Failed to delete file:", fileErr);
      }
    }

    // Remove from array
    imagePaths.splice(iIndex, 1);
    variantSummaries[vIndex] = { ...variant, imagePaths };

    // Update database
    await db.collection(PRODUCTS_COLLECTION).updateOne(query, { $set: { variantSummaries } });
    await db.collection(MAIN_PRODUCTS_COLLECTION).updateOne(query, { $set: { variantSummaries } });

    return res.json({ success: true, variantIndex: vIndex, imagePaths });
  } catch (err) {
    console.error("[handleVariantImageDelete] error", err);
    return res.status(500).json({ success: false, message: err instanceof Error ? err.message : String(err) });
  }
};
