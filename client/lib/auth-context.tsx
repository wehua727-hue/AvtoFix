import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: string;
  address?: string;
  telegramChatId?: string;
  subscriptionType?: "oddiy" | "cheksiz";
  subscriptionEndDate?: string;
  isBlocked?: boolean;
  canEditProducts?: boolean; // Xodim mahsulotlarni tahrirlash/o'chirish huquqi
}

interface AuthContextType {
  user: User | null;
  originalUser: User | null; // Egasining asl profili (loginAs ishlatilganda)
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  loginAs: (userId: string) => Promise<void>;
  returnToOriginal: () => void; // Asl profilga qaytish
  logout: () => void;
  updateUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL - работает для веб и Electron
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  // Electron с file:// протоколом
  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:5175';
  }
  // Для HTTP - используем относительные пути (работает для веб и Electron production)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes('YOUR_PUBLIC_IP')) {
    return envUrl.replace(/\/$/, '');
  }
  // Fallback: используем текущий origin
  return window.location.origin;
})();

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null); // Egasining asl profili
  const [isLoading, setIsLoading] = useState(true);

  // Проверка сохраненной сессии при загрузке
  useEffect(() => {
    const checkAuth = async () => {
      // Minimal loading time for smooth UX (2 sekund)
      const minLoadTime = new Promise((resolve) => setTimeout(resolve, 2000));
      
      const savedUser = localStorage.getItem('user');
      const savedOriginalUser = localStorage.getItem('originalUser');
      
      // Asl foydalanuvchini yuklash
      if (savedOriginalUser) {
        try {
          setOriginalUser(JSON.parse(savedOriginalUser));
        } catch (e) {
          localStorage.removeItem('originalUser');
        }
      }
      
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          // Верифицируем пользователя на сервере
          const res = await fetch(`${API_BASE}/api/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userData.id }),
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              setUser(data.user);
            } else {
              localStorage.removeItem('user');
            }
          } else {
            localStorage.removeItem('user');
          }
        } catch (error) {
          console.error('Auth verification failed:', error);
          // Оставляем локальные данные если сервер недоступен
          const userData = JSON.parse(savedUser);
          setUser(userData);
        }
      }
      
      // Minimal loading vaqtini kutish
      await minLoadTime;
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (phone: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });

    const data = await res.json();

    // Проверка на блокировку аккаунта
    if (res.status === 403 && data.error === 'account_blocked') {
      // Перенаправляем на страницу блокировки
      window.location.href = '/account-blocked';
      throw new Error(data.message || 'Akkaunt bloklangan');
    }

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Ошибка входа');
    }

    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('originalUser'); // loginAs uchun
  };

  // Boshqa foydalanuvchi sifatida kirish (faqat egasi uchun)
  const loginAs = async (userId: string) => {
    // Hozirgi foydalanuvchini saqlash (qaytish uchun)
    if (user && !localStorage.getItem('originalUser')) {
      localStorage.setItem('originalUser', JSON.stringify(user));
      setOriginalUser(user);
    }

    const res = await fetch(`${API_BASE}/api/auth/login-as`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, adminId: user?.id }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Kirishda xatolik');
    }

    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
  };

  // Asl profilga qaytish (loginAs dan keyin)
  const returnToOriginal = () => {
    const savedOriginalUser = localStorage.getItem('originalUser');
    if (savedOriginalUser) {
      const originalUserData = JSON.parse(savedOriginalUser);
      setUser(originalUserData);
      localStorage.setItem('user', JSON.stringify(originalUserData));
      localStorage.removeItem('originalUser');
      setOriginalUser(null);
    }
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, originalUser, isLoading, login, loginAs, returnToOriginal, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
