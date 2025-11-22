import multer from "multer";
import path from "path";
import fs from "fs";

const baseUploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));
const productUploadsDir = path.join(baseUploadsDir, "products");

if (!fs.existsSync(productUploadsDir)) {
  fs.mkdirSync(productUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, productUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const isImage = /^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype);
    if (!isImage) {
      cb(new Error("Only JPEG/PNG/WebP files are allowed"), false);
      return;
    }
    cb(null, true);
  },
});

export const addProductUpload = upload.single("image");
export { baseUploadsDir, productUploadsDir };
