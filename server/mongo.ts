import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const fallbackUri =
  process.env.MONGODB_URI_FALLBACK ||
  process.env.MONGODB_URI_DIRECT ||
  process.env.LOCAL_MONGODB_URI ||
  undefined;
const dbName = process.env.DB_NAME?.trim() || undefined;

if (!uri) {
  // Intentionally just log; app can still run in demo mode without DB
  console.warn("[mongo] MONGODB_URI is not set. MongoDB will not be connected.");
}

let isConnected = false;
let srvLookupWarningLogged = false;
let connectingPromise: Promise<mongoose.Mongoose> | null = null;

export async function connectMongo() {
  if (!uri) {
    // WPS da ham MongoDB connection ni ta'minlash
    console.warn("[mongo] MONGODB_URI is not set. Using fallback URI for WPS...");
    if (fallbackUri) {
      try {
        connectingPromise = mongoose
          .connect(fallbackUri, {
            serverSelectionTimeoutMS: Number(process.env.MONGO_SELECTION_TIMEOUT_MS ?? 15000),
            directConnection: true,
            dbName,
          } as any);
        const conn = await connectingPromise;
        connectingPromise = null;
        isConnected = true;
        console.log("[mongo] Connected to MongoDB via fallback URI (WPS)");
        return conn.connection;
      } catch (fallbackErr) {
        console.error("[mongo] Fallback connection failed (WPS):", fallbackErr);
      }
    }
    return null;
  }

  // If already connected
  if (mongoose.connection.readyState === 1 && isConnected) return mongoose.connection;
  // If a connection attempt is in-flight, await it
  if (connectingPromise) {
    try {
      await connectingPromise;
      return mongoose.connection.readyState === 1 ? mongoose.connection : null;
    } catch {
      // fall through to attempt again
    }
  }

  try {
    connectingPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: Number(process.env.MONGO_SELECTION_TIMEOUT_MS ?? 10000),
        dbName,
      });
    const conn = await connectingPromise;
    connectingPromise = null;
    isConnected = true;
    console.log("[mongo] Connected to MongoDB");
  
    // Indekslar yaratish - tezroq qidiruv uchun
    try {
      const db = conn.connection.db;
      if (db) {
        const productsCollection = process.env.OFFLINE_PRODUCTS_COLLECTION || "products";
        
        // Eski productCode indekslarini o'chirish (agar mavjud bo'lsa)
        try {
          await db.collection(productsCollection).dropIndex("productCode_1");
          console.log("[mongo] Dropped old productCode_1 index");
        } catch (dropErr: any) {
          // Agar indeks topilmasa, xato bermaydi
          if (dropErr?.code !== 27 && !dropErr?.message?.includes("index not found")) {
            console.warn("[mongo] Could not drop productCode_1 index:", dropErr?.message);
          }
        }
        
        // Murakkab store_1_productCode_1 indeksini o'chirish
        try {
          await db.collection(productsCollection).dropIndex("store_1_productCode_1");
          console.log("[mongo] Dropped old store_1_productCode_1 index");
        } catch (dropErr: any) {
          if (dropErr?.code !== 27 && !dropErr?.message?.includes("index not found")) {
            console.warn("[mongo] Could not drop store_1_productCode_1 index:", dropErr?.message);
          }
        }
        
        // MUHIM: code_1 indeksini o'chirish - duplicate key xatosini hal qilish uchun
        try {
          await db.collection(productsCollection).dropIndex("code_1");
          console.log("[mongo] Dropped old code_1 index");
        } catch (dropErr: any) {
          if (dropErr?.code !== 27 && !dropErr?.message?.includes("index not found")) {
            console.warn("[mongo] Could not drop code_1 index:", dropErr?.message);
          }
        }
        
        // Do'kon bo'yicha indeks
        await db.collection(productsCollection).createIndex({ store: 1 });
        
        // Yaratilgan sana bo'yicha indeks (teskari tartibda)
        await db.collection(productsCollection).createIndex({ createdAt: -1 });
        
        // Murakkab indeks: do'kon + yaratilgan sana
        await db.collection(productsCollection).createIndex({ store: 1, createdAt: -1 });
        
        console.log("[mongo] Indexes created successfully");
      }
    } catch (err) {
      console.error("[mongo] Failed to create indexes:", err);
    }
    
    return conn.connection;
  } catch (err: any) {
    connectingPromise = null;
    const code = err?.code as string | undefined;
    const host = (err as any)?.hostname as string | undefined;
    const message = (err?.message ?? "") as string;
    const isSrvFailure =
      err &&
      typeof err === "object" &&
      (
        ((code === "ENOTFOUND" || code === "EREFUSED" || code === "ETIMEOUT") && typeof host === "string" && host.includes("_mongodb._tcp"))
        || message.includes("querySrv ETIMEOUT")
      );

    if (isSrvFailure) {
      if (!srvLookupWarningLogged) {
        console.warn(
          "[mongo] DNS SRV lookup failed for the configured MongoDB Atlas URI. Running without MongoDB. Check your internet connection or update MONGODB_URI to a reachable host."
        );
        srvLookupWarningLogged = true;
      }
      // Try fallback non-SRV URI if provided
      if (fallbackUri) {
        try {
          connectingPromise = mongoose
            .connect(fallbackUri, {
              serverSelectionTimeoutMS: Number(process.env.MONGO_SELECTION_TIMEOUT_MS ?? 10000),
              directConnection: true,
              dbName,
            } as any);
          const conn = await connectingPromise;
          connectingPromise = null;
          isConnected = true;
          console.log("[mongo] Connected to MongoDB via fallback URI");
          return conn.connection;
        } catch (fallbackErr) {
          console.error("[mongo] Fallback connection failed:", fallbackErr);
        }
      }
      return null;
    }

    throw err;
  }
}

export function getMongoDb() {
  if (!isConnected) return null;
  return mongoose.connection.db;
}
