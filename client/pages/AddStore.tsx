import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';

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
    <div className="min-h-screen bg-gray-950">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />

      {/* Main Content */}
      <div className={`pt-16 pb-12 px-4 sm:px-6 lg:px-8 relative z-10 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
        <div className="max-w-2xl mx-auto">
          {/* Title */}
          <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
              <div className="relative bg-red-600 p-4 rounded-lg">
                <Store className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold mb-3 text-white">
              Magazin qo'shish
            </h1>
            <div className="h-1 w-32 mx-auto bg-red-600 mb-4"></div>
            <p className="text-gray-400 text-lg">Yangi magazin ma'lumotlarini kiriting</p>
          </div>

          {/* Form Card */}
          <div className="relative bg-gray-900 rounded-lg p-8 border border-gray-700">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Magazin nomi
                </label>
                <Input
                  type="text"
                  placeholder="Masalan: Markaziy do'kon"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-gray-800 border border-gray-700 hover:border-gray-600 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 transition-all text-lg"
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3.5 rounded-lg border border-gray-700 transition-all"
                  disabled={isLoading}
                >
                  Bekor qilish
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !storeName.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 rounded-lg transition-all disabled:opacity-50"
                >
                  <span className="flex items-center justify-center gap-2">
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
