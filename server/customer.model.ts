import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICustomer extends Document {
  userId: mongoose.Types.ObjectId; // Foydalanuvchi ID
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate: Date;
  notes?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    birthDate: { type: Date, required: true },
    notes: { type: String, trim: true },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastOrderDate: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Index for birthday queries
CustomerSchema.index({ birthDate: 1 });
CustomerSchema.index({ totalOrders: -1 });
CustomerSchema.index({ totalSpent: -1 });

export const CustomerModel: Model<ICustomer> =
  (mongoose.models.Customer as Model<ICustomer>) ||
  mongoose.model<ICustomer>("Customer", CustomerSchema);
