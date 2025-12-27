import mongoose, { Schema, Document } from 'mongoose';

export interface IDebt extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // Foydalanuvchi ID
  branchId?: string;
  creditor: string;
  amount: number;
  description?: string;
  phone?: string;
  countryCode?: string;
  debtDate: Date;
  dueDate?: Date; // To'lov muddati
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'unpaid';
  createdAt: Date;
  updatedAt: Date;
}

const DebtSchema = new Schema<IDebt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    branchId: { type: String },
    creditor: { type: String, required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    phone: { type: String },
    countryCode: { type: String, default: '+998' },
    debtDate: { type: Date, required: true },
    dueDate: { type: Date }, // To'lov muddati
    currency: { type: String, default: 'UZS' },
    status: { type: String, enum: ['pending', 'paid', 'overdue', 'unpaid'], default: 'pending' },
  },
  { timestamps: true }
);

export const Debt = mongoose.model<IDebt>('Debt', DebtSchema);
