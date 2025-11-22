import { RequestHandler } from "express";
import { ProductModel } from "./product.model";
import { compressImageToBuffer } from "./compress";
import { downloadImageFromLink } from "./fromLink";

export const handleAddProduct: RequestHandler = async (req, res) => {
  try {
    const { name, sizes: sizesRaw, imageUrl } = req.body as {
      name?: string;
      sizes?: string;
      imageUrl?: string;
    };

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "name is required" });
    }

    // Parse sizes string -> array
    const sizes = (sizesRaw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Determine image source: file upload or imageUrl
    // Typed as any to avoid hard dependency on Express.Multer types
    const file = (req as any).file as any;

    if (!file && !imageUrl) {
      return res.status(400).json({ success: false, message: "image file or imageUrl is required" });
    }

    let originalBuffer: Buffer;
    let contentType: string = "image/jpeg";

    if (file && file.buffer) {
      originalBuffer = file.buffer;
      contentType = file.mimetype || contentType;
    } else if (imageUrl) {
      const downloaded = await downloadImageFromLink(imageUrl);
      originalBuffer = downloaded.data;
      if (downloaded.contentType) {
        contentType = downloaded.contentType;
      }
    } else {
      return res.status(400).json({ success: false, message: "No image source provided" });
    }

    // Compress image down to ~100KB
    const compressed = await compressImageToBuffer(originalBuffer);

    const product = await ProductModel.create({
      name: name.trim(),
      sizes,
      images: [
        {
          data: compressed,
          contentType,
        },
      ],
    });

    return res.status(201).json({ success: true, product });
  } catch (err) {
    console.error("[api/add-product] error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
