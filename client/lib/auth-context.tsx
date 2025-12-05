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
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL - работает для веб и Electron
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  // Electron с file:// протоколом (не используется в production, но на всякий случай)
  if (window.location.protocol === 'file:') return 'http://127.0.0.1:5174';
  // Для HTTP - используем относительные пути (работает для веб и Electron production)
  return import.meta.env.VITE_API_URL || '';
})();

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Проверка сохраненной сессии при загрузке
  useEffect(() => {
    const checkAuth = async () => {
      const savedUser = localStorage.getItem('user');
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
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
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
