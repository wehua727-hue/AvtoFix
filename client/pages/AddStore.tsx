import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Header from '@/components/Layout/Header';
import Sidebar from '@/components/Layout/Sidebar';

export default function AddStore() {
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: storeName.trim() }),
      });

      if (!res.ok) {
        console.error('Failed to create store');
        return;
      }

      const data = await res.json();
      if (data?.success) {
        setStoreName('');
        navigate('/');
      }
    } catch (err) {
      console.error('Error creating store:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-950/20 to-gray-900">
      {/* Header */}
      <Header />

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-500/15 rounded-full blur-3xl"></div>
      </div>

      {/* Main Content */}
      <div className={`pt-24 sm:pt-26 lg:pt-28 pb-12 px-4 sm:px-6 lg:px-8 relative z-10 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
        <div className="max-w-2xl mx-auto">
          {/* Title */}
          <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
              <div className="relative group">
                <div className="absolute inset-0 bg-red-600 rounded-2xl blur-2xl opacity-60 group-hover:opacity-80 transition-opacity animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-red-600 via-red-700 to-red-800 p-4 rounded-2xl shadow-2xl shadow-red-900/50">
                  <Store className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold mb-3">
              <span className="bg-gradient-to-r from-white via-red-100 to-white bg-clip-text text-transparent">
                Magazin qo'shish
              </span>
            </h1>
            <div className="h-1 w-32 mx-auto bg-gradient-to-r from-transparent via-red-500 to-transparent mb-4"></div>
            <p className="text-gray-400 text-lg">Yangi magazin ma'lumotlarini kiriting</p>
          </div>

          {/* Form Card */}
          <div className="relative bg-gradient-to-br from-gray-800/90 via-gray-900/90 to-gray-800/90 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-red-900/20 p-8 border border-red-600/30 overflow-hidden">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-red-600/0 via-red-600/20 to-red-600/0 opacity-50"></div>
            
            <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Magazin nomi
                </label>
                <Input
                  type="text"
                  placeholder="Masalan: Markaziy do'kon"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-gray-700/50 border border-red-600/20 hover:border-red-500/40 text-white placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 transition-all text-lg"
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-3.5 rounded-xl border border-gray-600 transition-all"
                  disabled={isLoading}
                >
                  Bekor qilish
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !storeName.trim()}
                  className="relative flex-1 bg-gradient-to-r from-red-600 via-red-700 to-red-600 hover:from-red-700 hover:via-red-800 hover:to-red-700 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-red-900/50 hover:shadow-red-800/60 transition-all disabled:opacity-50 overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-white/20 to-red-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5" />
                    {isLoading ? 'Saqlanmoqda...' : 'Saqlash'}
                  </span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
