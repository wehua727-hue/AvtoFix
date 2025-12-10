// Debt types
export interface IDebt {
  _id: string;
  branchId?: string;
  creditor: string;
  amount: number;
  description?: string;
  phone?: string;
  countryCode?: string;
  debtDate: string;
  dueDate?: string; // To'lov muddati
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'unpaid'; // unpaid - to'lanmadi (qora ro'yxat)
  createdAt: string;
  updatedAt: string;
}

export interface IDebtHistory {
  _id: string;
  debtId: string;
  action: string;
  amount?: number;
  reason?: string;
  createdAt: string;
}

export interface IDebtFormData {
  creditor: string;
  amount: number;
  description?: string;
  phone?: string;
  countryCode?: string;
  debtDate: string;
  dueDate?: string; // To'lov muddati
  currency: string;
  branchId?: string;
}

export interface IDebtStats {
  total: number;
  pending: number;
  paid: number;
  totalAmount: number;
}
