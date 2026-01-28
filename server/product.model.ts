import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProductImage {
  data: Buffer;
  contentType: string;
}

export interface IProductVideo {
  filename: string;
  url?: string;
  size?: number;
}

export interface IVariantSummary {
  name: string;
  sku?: string;
  code?: string; // Excel dan kelgan kod
  catalogNumber?: string; // Excel dan kelgan katalog raqami
  basePrice?: number;
  priceMultiplier?: number;
  price?: number;
  currency?: string;
  stock?: number;
  initialStock?: number;
  status?: string;
  imagePaths?: string[];
}

// Bola mahsulot - ota mahsulot tugaganda ko'rinadigan mahsulot
export interface IChildProduct {
  productId: string;  // Bola mahsulot ID
  name: string;       // Bola mahsulot nomi (ko'rsatish uchun)
  autoActivate: boolean; // Ota tugaganda avtomatik faollashtirilsinmi?
}

export interface IProduct extends Document {
  offlineId?: string; // For offline-first sync idempotency
  userId?: string; // Привязка к пользователю
  storeId?: string; // Привязка к магазину (только для egasi и его xodim)
  name: string;
  sizes: string[];
  images: IProductImage[];
  video?: IProductVideo;
  price?: number;
  basePrice?: number;
  priceMultiplier?: number;
  currency?: string;
  sku?: string; // Nomerofka (1, 2, 3...)
  code?: string; // Excel dan kelgan kod
  catalogNumber?: string; // Excel dan kelgan katalog raqami
  categoryId?: string;
  stock?: number;
  initialStock?: number;
  status?: string;
  description?: string;
  imageUrl?: string;
  variantSummaries?: IVariantSummary[];
  // Ota-bola mahsulot tizimi
  parentProductId?: string; // Ota mahsulot ID (agar bu bola mahsulot bo'lsa)
  childProducts?: IChildProduct[]; // Bola mahsulotlar ro'yxati
  isHidden?: boolean; // Yashirinmi? (ota mahsulot tugamaguncha ko'rinmaydi)
  createdAt: Date;
  updatedAt: Date;
}

const ProductImageSchema = new Schema<IProductImage>(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
  },
  { _id: false },
);

const ProductVideoSchema = new Schema<IProductVideo>(
  {
    filename: { type: String, required: true },
    url: { type: String },
    size: { type: Number },
  },
  { _id: false },
);

const VariantSummarySchema = new Schema<IVariantSummary>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    code: { type: String, trim: true }, // Excel dan kelgan kod
    catalogNumber: { type: String, trim: true }, // Excel dan kelgan katalog
    basePrice: { type: Number },
    priceMultiplier: { type: Number },
    price: { type: Number },
    currency: { type: String, required: true, default: 'UZS' },
    stock: { type: Number },
    initialStock: { type: Number },
    status: { type: String, default: 'available' },
    imagePaths: { type: [String], default: [] },
  },
  { _id: false },
);

// Bola mahsulot schema
const ChildProductSchema = new Schema<IChildProduct>(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    autoActivate: { type: Boolean, default: true },
  },
  { _id: false },
);

const ProductSchema = new Schema<IProduct>(
  {
    offlineId: { type: String, unique: true, sparse: true, index: true }, // For offline sync
    userId: { type: String, index: true }, // Привязка к пользователю
    storeId: { type: String, index: true }, // Привязка к магазину (только для egasi и его xodim)
    name: { type: String, required: true, trim: true },
    sizes: { type: [String], default: [], index: true },
    images: { type: [ProductImageSchema], default: [] },
    video: { type: ProductVideoSchema },
    price: { type: Number },
    basePrice: { type: Number },
    priceMultiplier: { type: Number },
    currency: { type: String, required: true, default: 'UZS' },
    sku: { type: String }, // Nomerofka (1, 2, 3...)
    code: { type: String, trim: true }, // Excel dan kelgan kod
    catalogNumber: { type: String, trim: true }, // Excel dan kelgan katalog
    categoryId: { type: String },
    stock: { type: Number },
    initialStock: { type: Number },
    status: { type: String, default: 'available' },
    description: { type: String },
    imageUrl: { type: String },
    variantSummaries: { type: [VariantSummarySchema], default: [] },
    // Ota-bola mahsulot tizimi
    parentProductId: { type: String, index: true }, // Ota mahsulot ID
    childProducts: { type: [ChildProductSchema], default: [] }, // Bola mahsulotlar
    isHidden: { type: Boolean, default: false }, // Yashirin (ota tugamaguncha)
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Use dedicated collection for offline products if configured
const collectionName = process.env.OFFLINE_PRODUCTS_COLLECTION || "offline_products";

export const ProductModel: Model<IProduct> =
  (mongoose.models.Product as Model<IProduct>) ||
  mongoose.model<IProduct>("Product", ProductSchema, collectionName);
