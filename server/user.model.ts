import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  address?: string;
  password: string;
  role: "egasi" | "admin";
  telegramChatId?: string;
  subscriptionType?: "oddiy" | "cheksiz";
  subscriptionEndDate?: Date;
  isBlocked?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    address: { type: String },
    password: { type: String, required: true },
    role: { type: String, enum: ["egasi", "admin"], default: "admin" },
    telegramChatId: { type: String },
    subscriptionType: { type: String, enum: ["oddiy", "cheksiz"], default: "cheksiz" },
    subscriptionEndDate: { type: Date },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
