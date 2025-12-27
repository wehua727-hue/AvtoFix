import mongoose, { Schema, Document } from 'mongoose';

export interface IDebtHistory extends Document {
  _id: mongoose.Types.ObjectId;
  debtId: mongoose.Types.ObjectId;
  action: string;
  amount?: number;
  reason?: string;
  createdAt: Date;
}

const DebtHistorySchema = new Schema<IDebtHistory>(
  {
    debtId: { type: Schema.Types.ObjectId, ref: 'Debt', required: true },
    action: { type: String, required: true },
    amount: { type: Number },
    reason: { type: String },
  },
  { timestamps: true }
);

export const DebtHistory = mongoose.model<IDebtHistory>('DebtHistory', DebtHistorySchema);
