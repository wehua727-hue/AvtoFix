import mongoose, { Schema, Document } from 'mongoose';

export interface IBlacklist extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  creditor: string;
  phone?: string;
  reason?: string;
  debtId?: mongoose.Types.ObjectId;
  totalUnpaidAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const BlacklistSchema = new Schema<IBlacklist>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    creditor: { type: String, required: true },
    phone: { type: String },
    reason: { type: String },
    debtId: { type: Schema.Types.ObjectId, ref: 'Debt' },
    totalUnpaidAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

BlacklistSchema.index({ userId: 1, phone: 1 });
BlacklistSchema.index({ userId: 1, creditor: 1 });

export const Blacklist = mongoose.model<IBlacklist>('Blacklist', BlacklistSchema);
