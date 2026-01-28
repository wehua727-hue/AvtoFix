// Order types
export interface IOrder {
  _id: string;
  customerPhone: string;
  customerName?: string;
  items: IOrderItem[];
  totalAmount: number;
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface IOrderFormData {
  customerPhone: string;
  customerName?: string;
  items: IOrderItem[];
  totalAmount: number;
  notes?: string;
}

export interface IFrequentCustomer {
  phone: string;
  name?: string;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: string;
  isCustomer: boolean; // Mijozlar ro'yxatida bormi?
}
