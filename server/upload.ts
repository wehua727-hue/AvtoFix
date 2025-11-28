import multer from "multer";
import path from "path";
import fs from "fs";

const baseUploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));
const productUploadsDir = path.join(baseUploadsDir, "products");

if (!fs.existsSync(productUploadsDir)) {
  fs.mkdirSync(productUploadsDir, { recursive: true });
}

const storage = multer.memoryStorage();

// No file size limit - let the application handle it
// Accept common image formats including HEIC/HEIF
const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB max (will be compressed on server)
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ];
    const ok = allowedTypes.includes(file.mimetype) ||
               /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.originalname || "");
    if (!ok) {
      return cb(new Error("Only JPEG, PNG, WebP, or HEIC images are allowed"));
    }
    cb(null, true);
  },
});

export const addProductUpload = upload.single("image");
export { baseUploadsDir, productUploadsDir };
