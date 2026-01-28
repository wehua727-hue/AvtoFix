import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle, Loader2, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// API base URL - работает для веб и Electron
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'file:') return 'http://127.0.0.1:5174';
  return import.meta.env.VITE_API_URL || '';
})();
const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'YourBotUsername';

export default function TelegramSetup() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCheckConnection = async () => {
    if (!user) return;

    setIsChecking(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Обновляем данные пользователя в контексте
          updateUser(data.user);
          
          // Telegram tekshiruvi muvaffaqiyatli - darhol asosiy sahifaga o'tkazish
          if (data.user.telegramChatId) {
            toast.success('Muvaffaqiyatli ulandi!', {
              description: 'Telegram bot hisobingizga bog\'landi',
            });
          } else {
            toast.success('Tizimga kirildi!', {
              description: 'Asosiy sahifaga o\'tilmoqda...',
            });
          }
          // Darhol o'tkazish (kutmasdan)
          navigate('/');
        } else {
          toast.error('Xatolik yuz berdi', {
            description: 'Qayta urinib ko\'ring',
          });
        }
      } else {
        // Server javob bermasa ham o'tkazish
        toast.success('Davom etilmoqda...', {
          description: 'Asosiy sahifaga o\'tilmoqda...',
        });
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to check telegram connection:', error);
      // Xatolik bo'lsa ham o'tkazish (offline rejim uchun)
      toast.info('Davom etilmoqda...', {
        description: 'Asosiy sahifaga o\'tilmoqda...',
      });
      navigate('/');
    } finally {
      setIsChecking(false);
    }
  };

  const openTelegramBot = () => {
    if (!user) return;
    const botUrl = `https://t.me/${BOT_USERNAME}?start=${user.id}`;
    window.open(botUrl, '_blank');
  };

  const steps = [
    { number: 1, text: 'Pastdagi tugmani bosing' },
    { number: 2, text: 'Telegram bot ochiladi' },
    { number: 3, text: 'Botga /start bosing' },
    { number: 4, text: 'Bu sahifaga qaytib, "Tekshirish" tugmasini bosing' },
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 overflow-hidden relative">
      {/* Subtle background blur effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Logout Button - Top Right */}
      <motion.button
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onClick={handleLogout}
        className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 backdrop-blur-sm text-white/80 hover:text-white rounded-lg border border-white/10 transition-all duration-200 hover:scale-105 active:scale-95 group z-10"
      >
        <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" />
        <span className="text-sm font-medium">Chiqish</span>
      </motion.button>
      
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl pointer-events-none" />

        <div className="relative space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/50"
            >
              <Send className="w-8 h-8 text-white" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-5xl font-bold text-white tracking-tight"
            >
              Telegram Bot'ga Ulanish
            </motion.h1>
          </div>

          {/* Steps Box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 space-y-4"
          >
            <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider">
              Qanday qilish kerak:
            </h2>
            <div className="grid gap-4">
              {steps.map((step, index) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="flex items-start gap-4 group"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                    {step.number}
                  </div>
                  <p className="text-slate-300 leading-relaxed pt-1">
                    {step.text}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <button
              onClick={openTelegramBot}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200 hover:scale-[1.02] hover:shadow-blue-500/50 active:scale-[0.98]"
            >
              <Send className="w-5 h-5" />
              Telegram Botni Ochish
            </button>

            <button
              onClick={handleCheckConnection}
              disabled={isChecking}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChecking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Tekshirilmoqda...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Tekshirish
                </>
              )}
            </button>
          </motion.div>
        </div>
    </div>
  );
}
