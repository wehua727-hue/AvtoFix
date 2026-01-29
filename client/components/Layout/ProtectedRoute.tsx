import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  // isLoading bo'lsa, AuthLoadingWrapper 3D loader ko'rsatadi
  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Local development uchun Telegram tekshiruvini o'chirish
  // Production da bu qatorni qaytarish kerak:
  // if (!user.telegramChatId) {
  //   return <Navigate to="/telegram-setup" replace />;
  // }

  return <>{children}</>;
}
