export interface Product {
  id: string;
  name: string;
  code: string;
  stock: number;
  price: number; // in so'm
}

export const PRODUCTS: Product[] = [
  { id: '1', name: 'Premium Headphones', code: 'PH-001', stock: 12, price: 450000 },
  { id: '2', name: 'Smart Watch', code: 'SW-002', stock: 7, price: 650000 },
  { id: '3', name: 'Wireless Charger', code: 'WC-003', stock: 25, price: 180000 },
  { id: '4', name: 'Portable Speaker', code: 'PS-004', stock: 9, price: 320000 },
  { id: '5', name: 'Phone Case', code: 'PC-005', stock: 43, price: 95000 },
  { id: '6', name: 'USB-C Cable', code: 'UC-006', stock: 60, price: 65000 },
];
