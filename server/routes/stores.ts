import { RequestHandler } from "express";
import mongoose from "mongoose";
import { connectMongo } from "../mongo";
import { User } from "../user.model";
import { ProductModel } from "../product.model";

const ObjectId = mongoose.Types.ObjectId;

interface StoreDoc {
  _id: any;
  name?: string;
  createdBy?: any;
  manager?: any;
}

export const handleStoresGet: RequestHandler = async (_req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ stores: [], message: "MongoDB ulanmagan" });
    }

    const db = conn.db;
    const raw: StoreDoc[] = await db.collection("stores").find({}).toArray();

    const stores = raw.map((s) => ({
      id: s._id?.toString?.() ?? "",
      name: s.name ?? "",
    }));

    return res.json({ stores });
  } catch (err) {
    console.error("[api/stores] error", err);
    return res.status(500).json({ stores: [], message: "Server xatosi" });
  }
};

export const handleStoresCreate: RequestHandler = async (req, res) => {
  try {
    const { name } = req.body || {};

    if (!name) {
      return res.status(400).json({ success: false, message: "name kerak" });
    }

    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, message: "MongoDB ulanmagan" });
    }

    const db = conn.db;
    const result = await db.collection("stores").insertOne({ name });

    const store = {
      id: result.insertedId.toString(),
      name,
    };

    return res.status(201).json({ success: true, store });
  } catch (err) {
    console.error("[api/stores POST] error", err);
    return res.status(500).json({ success: false, message: "Server xatosi" });
  }
};

/**
 * DELETE /api/stores/:id
 * Magazinni o'chirish - tegishli xodim va mahsulotlarni ham o'chiradi
 */
export const handleStoreDelete: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Noto'g'ri store ID" });
    }

    const conn = await connectMongo();
    if (!conn || !conn.db) {
      return res.status(500).json({ success: false, message: "MongoDB ulanmagan" });
    }

    const db = conn.db;
    const storeObjectId = new ObjectId(id);
    
    // Store ni topish
    const store = await db.collection("stores").findOne({ _id: storeObjectId }) as StoreDoc | null;
    if (!store) {
      return res.status(404).json({ success: false, message: "Magazin topilmadi" });
    }

    console.log(`[api/stores DELETE] Deleting store: ${id}, name: ${store.name}`);
    
    let deletedUser = false;
    let deletedProducts = 0;

    // Store ga tegishli xodimni topish va o'chirish
    // Store yaratilganda createdBy va manager sifatida user ID saqlanadi
    if (store.createdBy || store.manager) {
      const userIdToDelete = store.createdBy || store.manager;
      
      try {
        // User ID ni string ga aylantirish
        const userIdStr = userIdToDelete.toString();
        
        // Xodimni topish
        const user = await User.findById(userIdStr);
        
        if (user) {
          console.log(`[api/stores DELETE] Found user to delete: ${user.name} (${user._id})`);
          
          // Xodimning mahsulotlarini o'chirish
          const productResult = await ProductModel.deleteMany({ userId: userIdStr });
          deletedProducts = productResult.deletedCount;
          console.log(`[api/stores DELETE] Deleted ${deletedProducts} products for user ${userIdStr}`);
          
          // Xodimni o'chirish
          await User.findByIdAndDelete(userIdStr);
          deletedUser = true;
          console.log(`[api/stores DELETE] Deleted user: ${user.name}`);
        }
      } catch (userErr) {
        console.error(`[api/stores DELETE] Error deleting user:`, userErr);
      }
    }

    // Store ni o'chirish
    await db.collection("stores").deleteOne({ _id: storeObjectId });
    console.log(`[api/stores DELETE] Store deleted: ${store.name}`);

    return res.json({ 
      success: true, 
      message: "Magazin va tegishli xodim o'chirildi",
      deleted: {
        store: true,
        user: deletedUser,
        products: deletedProducts
      }
    });
  } catch (err) {
    console.error("[api/stores DELETE] error", err);
    return res.status(500).json({ success: false, message: "Server xatosi" });
  }
};
