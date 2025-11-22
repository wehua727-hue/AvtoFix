import { RequestHandler } from "express";
import { connectMongo } from "../mongo";

interface StoreDoc {
  _id: any;
  name?: string;
}

export const handleStoresGet: RequestHandler = async (_req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn) {
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
    if (!conn) {
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
