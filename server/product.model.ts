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

export interface IProduct extends Document {
  name: string;
  sizes: string[];
  images: IProductImage[];
  video?: IProductVideo;
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

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    sizes: { type: [String], default: [], index: true },
    images: { type: [ProductImageSchema], default: [] },
    video: { type: ProductVideoSchema },
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
