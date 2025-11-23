import { RequestHandler } from "express";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { connectMongo } from "../mongo";
import { compressImageToBuffer } from "../compress";
import { saveVideoToGridFS, deleteVideoFromGridFS, getVideoFromGridFS } from "../gridfs";

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

interface ProductDoc {
  _id: any;
  name?: string;
  price?: number;
  sku?: string;
  categoryId?: any;
  stock?: number;
  imagePath?: string | null;
  sizes?: string[];
  variants?: ProductVariantDoc[];
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
      let video = (p as any).video || null;

      if (video && video.gridfsId && !video.url) {
        video = { ...video, url: `/api/products/${id}/video` };
      }

      return {
        id,
        name: p.name ?? "",
        price: typeof p.price === "number" ? p.price : null,
        basePrice: typeof (p as any).basePrice === "number" ? (p as any).basePrice : null,
        priceMultiplier: typeof (p as any).priceMultiplier === "number" ? (p as any).priceMultiplier : null,
        sku: p.sku ?? "",
        categoryId: p.categoryId ? p.categoryId.toString?.() ?? null : null,
        stock: typeof p.stock === "number" ? p.stock : null,
        sizes: sizesFromVariants,
        variants: normalizedVariants,
        imageUrl,
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

    const product = {
      id: idStr,
      name: doc.name ?? "",
      price: typeof doc.price === "number" ? doc.price : null,
      basePrice: typeof (doc as any).basePrice === "number" ? (doc as any).basePrice : null,
      priceMultiplier: typeof (doc as any).priceMultiplier === "number" ? (doc as any).priceMultiplier : null,
      sku: doc.sku ?? "",
      categoryId: doc.categoryId ? doc.categoryId.toString?.() ?? null : null,
      stock: typeof doc.stock === "number" ? doc.stock : null,
      sizes: sizesFromVariants,
      variants: normalizedVariants,
      imageUrl: (doc as any).imageUrl || doc.imagePath || null,
      video: videoData,
      store: doc.store ? doc.store.toString?.() ?? null : null,
      status: normalizeProductStatus((doc as any).status),
    };

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

    const { name, sku, price, basePrice, priceMultiplier, categoryId, stock, imageBase64, sizes, variants, store, status, videoFilename, videoSize, videoBase64 } = req.body as {
      name?: string;
      sku?: string;
      price?: number;
      basePrice?: number;
      priceMultiplier?: number;
      categoryId?: string;
      stock?: number;
      imageBase64?: string;
      sizes?: string;
      variants?: any;
      store?: string;
      status?: string;
      videoFilename?: string;
      videoSize?: number;
      videoBase64?: string;
    };

    console.log('[api/products POST] Received data:', { name, sku, price, basePrice, priceMultiplier, stock });

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

    if (typeof imageBase64 === "string" && imageBase64.trim()) {
      try {
        console.log("[api/products POST] Processing image, length:", imageBase64.length);
        const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
        
        if (!base64Data || base64Data.trim().length === 0) {
          throw new Error("Base64 data is empty after parsing");
        }
        
        const originalBuffer = Buffer.from(base64Data, "base64");
        console.log("[api/products POST] Buffer size:", originalBuffer.length);
        
        if (originalBuffer.length === 0) {
          throw new Error("Buffer is empty after decoding");
        }
        
        const compressed = await compressImageToBuffer(originalBuffer);
        console.log("[api/products POST] Compressed size:", compressed.length);

        const uploadsRoot = path.join(uploadsBase, "products");
        console.log("[api/products POST] Uploads root:", uploadsRoot);
        console.log("[api/products POST] Uploads base:", uploadsBase);
        console.log("[api/products POST] Directory exists:", fs.existsSync(uploadsRoot));
        
        if (!fs.existsSync(uploadsRoot)) {
          console.log("[api/products POST] Creating uploads directory");
          try {
            fs.mkdirSync(uploadsRoot, { recursive: true });
            console.log("[api/products POST] Directory created successfully");
          } catch (mkdirErr) {
            console.error("[api/products POST] Failed to create directory:", mkdirErr);
            throw mkdirErr;
          }
        }
        
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const absPath = path.join(uploadsRoot, fileName);
        console.log("[api/products POST] Saving to:", absPath);
        
        try {
          fs.writeFileSync(absPath, compressed);
          console.log("[api/products POST] Image saved successfully!");
        } catch (writeErr) {
          console.error("[api/products POST] Failed to write file:", writeErr);
          throw writeErr;
        }

        const publicPath = `/uploads/products/${fileName}`;
        doc.imagePath = publicPath;
      } catch (e) {
        console.error("[api/products POST] failed to process imageBase64", e);
        return res.status(400).json({ success: false, message: `Image processing failed: ${e instanceof Error ? e.message : String(e)}` });
      }
    } else {
      console.log("[api/products POST] No image provided");
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

    console.log("[api/products POST] Inserting document into database:", { name: doc.name, sku: doc.sku, hasImage: !!doc.imagePath });
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
      imageUrl: (doc as any).imageUrl || doc.imagePath || null,
      video: finalVideo || null,
      store: doc.store ? doc.store.toString?.() ?? null : null,
      status: cleanStatus,
    };

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

    const { name, sku, price, basePrice, priceMultiplier, stock, categoryId, imageBase64, sizes, variants, store, status, videoFilename, videoSize, videoBase64 } = req.body as {
      name?: string;
      sku?: string;
      price?: number;
      basePrice?: number;
      priceMultiplier?: number;
      stock?: number;
      categoryId?: string;
      imageBase64?: string;
      sizes?: string;
      variants?: any;
      store?: string;
      status?: string;
      videoFilename?: string;
      videoSize?: number;
      videoBase64?: string;
    };

    console.log('[api/products PUT] Received data:', { name, sku, price, basePrice, priceMultiplier, stock });

    const update: any = {};
    if (typeof name === "string") update.name = name.trim();
    if (typeof sku === "string") update.sku = sku.trim();
    if (price !== undefined) update.price = typeof price === "number" ? price : Number(price ?? 0) || 0;
    if (basePrice !== undefined) update.basePrice = typeof basePrice === "number" ? basePrice : Number(basePrice ?? 0) || 0;
    if (priceMultiplier !== undefined) update.priceMultiplier = typeof priceMultiplier === "number" ? priceMultiplier : Number(priceMultiplier ?? 0) || 0;
    if (stock !== undefined) update.stock = typeof stock === "number" ? stock : Number(stock ?? 0) || 0;
    
    console.log('[api/products PUT] Update object:', { price: update.price, basePrice: update.basePrice, priceMultiplier: update.priceMultiplier });

    if (imageBase64 !== undefined) {
      if (typeof imageBase64 === "string" && imageBase64.trim()) {
        try {
          console.log("[api/products PUT] Processing image, length:", imageBase64.length);
          const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
          
          if (!base64Data || base64Data.trim().length === 0) {
            throw new Error("Base64 data is empty after parsing");
          }
          
          const originalBuffer = Buffer.from(base64Data, "base64");
          console.log("[api/products PUT] Buffer size:", originalBuffer.length);
          
          if (originalBuffer.length === 0) {
            throw new Error("Buffer is empty after decoding");
          }
          
          const compressed = await compressImageToBuffer(originalBuffer);
          console.log("[api/products PUT] Compressed size:", compressed.length);

          const uploadsRoot = path.join(uploadsBase, "products");
          console.log("[api/products PUT] Uploads root:", uploadsRoot);
          console.log("[api/products PUT] Uploads base:", uploadsBase);
          console.log("[api/products PUT] Directory exists:", fs.existsSync(uploadsRoot));
          
          if (!fs.existsSync(uploadsRoot)) {
            console.log("[api/products PUT] Creating uploads directory");
            try {
              fs.mkdirSync(uploadsRoot, { recursive: true });
              console.log("[api/products PUT] Directory created successfully");
            } catch (mkdirErr) {
              console.error("[api/products PUT] Failed to create directory:", mkdirErr);
              throw mkdirErr;
            }
          }
          
          const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const absPath = path.join(uploadsRoot, fileName);
          console.log("[api/products PUT] Saving to:", absPath);
          
          try {
            fs.writeFileSync(absPath, compressed);
            console.log("[api/products PUT] Image saved successfully!");
          } catch (writeErr) {
            console.error("[api/products PUT] Failed to write file:", writeErr);
            throw writeErr;
          }

          const publicPath = `/uploads/products/${fileName}`;
          update.imagePath = publicPath;
        } catch (e) {
          console.error("[api/products PUT] failed to process imageBase64", e);
          return res.status(400).json({ success: false, message: `Image processing failed: ${e instanceof Error ? e.message : String(e)}` });
        }
      } else {
        console.log("[api/products PUT] Clearing image");
        update.imagePath = null;
      }
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

    const db = conn.db;

    let query: any;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      query = { _id: id };
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

    try {
      await db.collection(MAIN_PRODUCTS_COLLECTION).updateOne(query, { $set: update }, { upsert: true });
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

    const product = {
      id: idStr,
      name: doc.name ?? "",
      price: typeof doc.price === "number" ? doc.price : null,
      sku: doc.sku ?? "",
      categoryId: doc.categoryId ? doc.categoryId.toString?.() ?? null : null,
      stock: typeof doc.stock === "number" ? doc.stock : null,
      sizes: sizesFromVariants,
      variants: normalizedVariants,
      imageUrl: (doc as any).imageUrl || doc.imagePath || null,
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

    res.setHeader("Content-Type", "image/jpeg");
    return res.sendFile(absPath);
  } catch (err) {
    console.error("[api/products/:id/image] error", err);
    return res.status(500).send("Server xatosi");
  }
};
