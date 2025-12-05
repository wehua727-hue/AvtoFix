// Customer types
export interface ICustomer {
  _id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate: string; // ISO date string
  notes?: string;
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICustomerFormData {
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate: string;
  notes?: string;
}

export interface IBirthdayNotification {
  customer: ICustomer;
  daysUntil: number;
  isToday: boolean;
}
