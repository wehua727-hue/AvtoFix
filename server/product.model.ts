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
  basePrice?: number;
  priceMultiplier?: number;
  price?: number;
  currency?: string;
  originalBasePrice?: number;
  originalPrice?: number;
  stock?: number;
  status?: string;
  categoryId?: string;
  imagePaths?: string[];
}

export interface IProduct extends Document {
  name: string;
  sizes: string[];
  images: IProductImage[];
  video?: IProductVideo;
  price?: number;
  basePrice?: number;
  priceMultiplier?: number;
  currency?: string;
  sku?: string;
  categoryId?: string;
  stock?: number;
  status?: string;
  variantSummaries?: IVariantSummary[];
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
    basePrice: { type: Number },
    priceMultiplier: { type: Number },
    price: { type: Number },
    currency: { type: String, required: true, default: 'UZS' },
    originalBasePrice: { type: Number },
    originalPrice: { type: Number },
    stock: { type: Number },
    status: { type: String, default: 'available' },
    categoryId: { type: String },
    imagePaths: { type: [String], default: [] },
  },
  { _id: false },
);

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    sizes: { type: [String], default: [], index: true },
    images: { type: [ProductImageSchema], default: [] },
    video: { type: ProductVideoSchema },
    price: { type: Number },
    basePrice: { type: Number },
    priceMultiplier: { type: Number },
    currency: { type: String, required: true, default: 'UZS' },
    sku: { type: String },
    categoryId: { type: String },
    stock: { type: Number },
    status: { type: String, default: 'available' },
    variantSummaries: { type: [VariantSummarySchema], default: [] },
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
