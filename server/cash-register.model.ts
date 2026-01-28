import mongoose, { Schema, Document } from "mongoose";

export interface ICashRegisterItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  discount: number;
}

export interface ICashRegisterCheck extends Document {
  items: ICashRegisterItem[];
  total: number;
  type: "pending" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

const CashRegisterItemSchema = new Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  price: { type: Number, required: true, default: 0 },
  discount: { type: Number, default: 0 },
});

const CashRegisterCheckSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    items: [CashRegisterItemSchema],
    total: { type: Number, required: true, default: 0 },
    type: { type: String, enum: ["pending", "completed", "current"], default: "pending" },
    paymentType: { type: String, enum: ["Naqd", "Karta", "O'tkazma", "Aralash"], default: null },
    saleType: { type: String, enum: ["sale", "refund"], default: "sale" },
  },
  { timestamps: true }
);

export const CashRegisterCheck = mongoose.model<ICashRegisterCheck>(
  "CashRegisterCheck",
  CashRegisterCheckSchema
);
