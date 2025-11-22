import { RequestHandler } from "express";
import mongoose from "mongoose";
import { connectMongo } from "../mongo";

const ObjectId = mongoose.Types.ObjectId;

export const handleImageGet: RequestHandler = async (req, res) => {
  try {
    const conn = await connectMongo();
    if (!conn) {
      console.error('[api/images/:id] MongoDB connection failed');
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

    console.log('[api/images/:id] Looking for image:', id);

    // avtofix.images kollektsiyasidan rasm olish
    const imageDoc = await db.collection("images").findOne(query);

    if (!imageDoc) {
      console.error('[api/images/:id] Image not found:', id);
      return res.status(404).send("Rasm topilmadi");
    }

    console.log('[api/images/:id] Image found, size:', imageDoc.size);

    // Content-Type ni o'rnatish
    const contentType = imageDoc.contentType || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 yil kesh

    // Binary data ni yuborish
    if (imageDoc.data && imageDoc.data.buffer) {
      return res.send(Buffer.from(imageDoc.data.buffer));
    } else if (Buffer.isBuffer(imageDoc.data)) {
      return res.send(imageDoc.data);
    } else {
      console.error('[api/images/:id] Invalid image data format');
      return res.status(500).send("Rasm formati noto'g'ri");
    }
  } catch (err) {
    console.error("[api/images/:id] error", err);
    return res.status(500).send("Server xatosi");
  }
};
