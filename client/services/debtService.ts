import type { IDebt, IDebtFormData, IDebtHistory } from '@shared/debt-types';

// API base URL - Electron va browser uchun
const API_BASE = (() => {
  // Electron da file:// protokoli ishlatiladi
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return 'http://127.0.0.1:5174';
  }
  // Environment variable
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes('YOUR_PUBLIC_IP')) {
    return envUrl;
  }
  // Default - bo'sh (relative URL)
  return '';
})();

// Debts
export const getAllDebts = async (): Promise<{ success: boolean; debts: IDebt[] }> => {
  // localStorage dan userId ni olish
  const userStr = localStorage.getItem('user');
  const userId = userStr ? JSON.parse(userStr).id : null;
  
  console.log('[DebtService] getAllDebts - userId:', userId, 'API_BASE:', API_BASE);
  
  const response = await fetch(`${API_BASE}/api/debts?userId=${userId}`, {
    headers: {
      'x-user-id': userId || '',
    },
  });
  
  console.log('[DebtService] Response status:', response.status);
  const data = await response.json();
  console.log('[DebtService] Response data:', data);
  return data;
};

export const addDebt = async (debtData: IDebtFormData) => {
  // localStorage dan userId ni olish
  const userStr = localStorage.getItem('user');
  const userId = userStr ? JSON.parse(userStr).id : null;
  
  const response = await fetch(`${API_BASE}/api/debts`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-user-id': userId || '',
    },
    body: JSON.stringify({ ...debtData, userId }),
  });
  const data = await response.json();
  return data;
};

export const updateDebt = async (debtId: string, updateData: Partial<IDebtFormData>) => {
  const response = await fetch(`${API_BASE}/api/debts/${debtId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  });
  const data = await response.json();
  return data;
};

export const markDebtAsPaid = async (debtId: string, reason = '') => {
  const response = await fetch(`${API_BASE}/api/debts/${debtId}/paid`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const data = await response.json();
  return data;
};

export const markDebtAsUnpaid = async (debtId: string, reason = '') => {
  const response = await fetch(`${API_BASE}/api/debts/${debtId}/unpaid`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const data = await response.json();
  return data;
};

// Blacklist
export const getBlacklist = async () => {
  const userStr = localStorage.getItem('user');
  const userId = userStr ? JSON.parse(userStr).id : null;
  
  const response = await fetch(`${API_BASE}/api/blacklist?userId=${userId}`, {
    headers: { 'x-user-id': userId || '' },
  });
  const data = await response.json();
  return data;
};

export const checkBlacklist = async (phone?: string, creditor?: string) => {
  const userStr = localStorage.getItem('user');
  const userId = userStr ? JSON.parse(userStr).id : null;
  
  const params = new URLSearchParams({ userId: userId || '' });
  if (phone) params.append('phone', phone);
  if (creditor) params.append('creditor', creditor);
  
  const response = await fetch(`${API_BASE}/api/blacklist/check?${params}`, {
    headers: { 'x-user-id': userId || '' },
  });
  const data = await response.json();
  return data;
};

export const deleteDebt = async (debtId: string, reason = '') => {
  const response = await fetch(`${API_BASE}/api/debts/${debtId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const data = await response.json();
  return data;
};

export const adjustDebtAmount = async (
  debtId: string,
  amount: number,
  type: 'add' | 'subtract',
  reason = ''
) => {
  const response = await fetch(`${API_BASE}/api/debts/${debtId}/adjust`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, type, reason }),
  });
  const data = await response.json();
  return data;
};

export const getDebtHistory = async (debtId: string): Promise<{ success: boolean; history: IDebtHistory[] }> => {
  const response = await fetch(`${API_BASE}/api/debts/${debtId}/history`);
  const data = await response.json();
  return data;
};
