import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, X, Phone, MapPin, Car, User, Navigation, CheckCircle } from 'lucide-react';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  address: string;
  location?: {
    lat: number;
    lng: number;
  };
  locationLink?: string;
  carModel: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

const API_BASE_URL = (() => {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:5175';
  }
  const envApiUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const isPlaceholder = envApiUrl && (
    envApiUrl.includes('YOUR_PUBLIC_IP') ||
    envApiUrl.includes('your_public_ip')
  );
  if (envApiUrl && !isPlaceholder) {
    try {
      const u = new URL(envApiUrl);
      const pageIsHttps = window.location.protocol === 'https:';
      const apiIsHttp = u.protocol === 'http:';
      if (pageIsHttps && apiIsHttp) {
        u.protocol = 'https:';
      }
      return u.toString().replace(/\/$/, '');
    } catch {
      return envApiUrl;
    }
  }
  return '';
})();

export default function CustomerData() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCarModel, setSelectedCarModel] = useState<string>(''); // Yangi: mashina filteri
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerData | null>(null); // Yangi: o'chirish uchun
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // Yangi: o'chirish jarayoni

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLink, setLocationLink] = useState(''); // Telegram/Google Maps link
  const [carModel, setCarModel] = useState('');

  // Load customers
  useEffect(() => {
    loadCustomers();
  }, [user?.id]);

  const loadCustomers = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/customer-data?userId=${user.id}`);
      if (!response.ok) throw new Error('Failed to load customers');
      
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Mijozlarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !phone.trim()) {
      toast.error('Ism va telefon raqami kiritilishi shart');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        location: location || undefined,
        locationLink: locationLink.trim() || undefined,
        carModel: carModel.trim(),
        userId: user?.id,
      };

      // Debug: location ni log qilish
      console.log('[CustomerData] Saving customer with location:', location);
      console.log('[CustomerData] Saving customer with locationLink:', locationLink);
      console.log('[CustomerData] Full payload:', payload);

      const url = editingCustomer
        ? `${API_BASE_URL}/api/customer-data/${editingCustomer.id}`
        : `${API_BASE_URL}/api/customer-data`;
      
      const method = editingCustomer ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save customer');

      toast.success(editingCustomer ? 'Mijoz yangilandi' : 'Mijoz qo\'shildi');
      loadCustomers();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error('Mijozni saqlashda xatolik');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/customer-data/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete customer');

      toast.success('Mijoz o\'chirildi');
      loadCustomers();
      setDeletingCustomer(null);
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Mijozni o\'chirishda xatolik');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = (customer: CustomerData) => {
    setDeletingCustomer(customer);
  };

  const handleEdit = (customer: CustomerData) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone || '+998 ');
    setAddress(customer.address);
    setLocation(customer.location || null);
    setLocationLink(customer.locationLink || ''); // Link ni yuklash
    setCarModel(customer.carModel);
    setShowAddDialog(true);
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingCustomer(null);
    setName('');
    setPhone('+998 ');
    setAddress('');
    setLocation(null);
    setLocationLink('');
    setCarModel('');
  };

  // Telefon raqamini formatlash
  const formatPhoneNumber = (value: string) => {
    // Faqat raqamlarni olish
    const numbers = value.replace(/\D/g, '');
    
    // Agar 998 bilan boshlanmasa, qo'shish
    let formatted = numbers;
    if (!formatted.startsWith('998')) {
      formatted = '998' + formatted;
    }
    
    // Formatlash: +998 XX XXX XX XX
    if (formatted.length <= 3) {
      return '+' + formatted;
    } else if (formatted.length <= 5) {
      return `+${formatted.slice(0, 3)} ${formatted.slice(3)}`;
    } else if (formatted.length <= 8) {
      return `+${formatted.slice(0, 3)} ${formatted.slice(3, 5)} ${formatted.slice(5)}`;
    } else if (formatted.length <= 10) {
      return `+${formatted.slice(0, 3)} ${formatted.slice(3, 5)} ${formatted.slice(5, 8)} ${formatted.slice(8)}`;
    } else {
      return `+${formatted.slice(0, 3)} ${formatted.slice(3, 5)} ${formatted.slice(5, 8)} ${formatted.slice(8, 10)} ${formatted.slice(10, 12)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatPhoneNumber(value);
    setPhone(formatted);
  };

  // Get unique car models
  const uniqueCarModels = useMemo(() => {
    const models = customers
      .map(c => c.carModel)
      .filter(Boolean)
      .filter((model, index, self) => self.indexOf(model) === index)
      .sort();
    return models;
  }, [customers]);

  // Filter customers with priority and highlight
  const filteredCustomers = useMemo(() => {
    let results = customers;

    // Mashina modeli bo'yicha filtrlash
    if (selectedCarModel) {
      results = results.filter(c => c.carModel === selectedCarModel);
    }

    // Qidiruv bo'yicha filtrlash
    if (!search.trim()) return results;

    const searchLower = search.toLowerCase().trim();
    
    // Qidiruv natijalarini prioritet bilan saralash
    const searchResults = results.map(customer => {
      const nameLower = customer.name.toLowerCase();
      const phoneLower = customer.phone.toLowerCase();
      const addressLower = customer.address?.toLowerCase() || '';
      const carModelLower = customer.carModel?.toLowerCase() || '';
      
      let priority = 0;
      let matchedFields: string[] = [];
      
      // Nom boshida mos kelsa - eng yuqori prioritet
      if (nameLower.startsWith(searchLower)) {
        priority = 4;
        matchedFields.push('name');
      }
      // Nom ichida mos kelsa
      else if (nameLower.includes(searchLower)) {
        priority = 3;
        matchedFields.push('name');
      }
      // Telefon raqamida mos kelsa
      if (phoneLower.includes(searchLower)) {
        priority = Math.max(priority, 2);
        matchedFields.push('phone');
      }
      // Manzilda mos kelsa
      if (addressLower.includes(searchLower)) {
        priority = Math.max(priority, 1);
        matchedFields.push('address');
      }
      // Mashina modelida mos kelsa
      if (carModelLower.includes(searchLower)) {
        priority = Math.max(priority, 1);
        matchedFields.push('carModel');
      }
      
      return { customer, priority, matchedFields };
    })
    .filter(item => item.priority > 0)
    .sort((a, b) => b.priority - a.priority)
    .map(item => item.customer);
    
    return searchResults;
  }, [customers, search, selectedCarModel]);

  // Highlight text function
  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, index) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={index} className="bg-yellow-400/30 text-foreground font-semibold rounded px-0.5">
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
        <Navbar onMenuClick={() => setSidebarOpen(true)} sidebarCollapsed={sidebarCollapsed} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 mt-12 sm:mt-14 lg:mt-16 bg-gradient-to-br from-background via-background to-muted/20">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 p-6 rounded-2xl border border-border/50 backdrop-blur-sm">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Mijoz Datalari
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Mijozlar ma'lumotlarini boshqarish
                </p>
              </div>
              <Button
                onClick={() => setShowAddDialog(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shrink-0 shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transition-all duration-300"
              >
                <Plus className="w-4 h-4 mr-2" />
                Mijoz qo'shish
              </Button>
            </div>

            {/* Search and Filter */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Search */}
              <div className="lg:col-span-2 relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300 opacity-0 group-hover:opacity-100"></div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Mijoz qidirish (ism, telefon, mashina)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-card/80 backdrop-blur-sm border border-border hover:border-blue-500/50 focus:border-blue-500 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 shadow-lg"
                  />
                </div>
              </div>

              {/* Car Model Filter */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300 opacity-0 group-hover:opacity-100"></div>
                <div className="relative">
                  <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-hover:text-purple-500 transition-colors z-10" />
                  <select
                    value={selectedCarModel}
                    onChange={(e) => setSelectedCarModel(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-card/80 backdrop-blur-sm border border-border hover:border-purple-500/50 focus:border-purple-500 text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-300 shadow-lg appearance-none cursor-pointer"
                  >
                    <option value="">Barcha mashinalar</option>
                    {uniqueCarModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  {selectedCarModel && (
                    <button
                      onClick={() => setSelectedCarModel('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors z-10"
                    >
                      <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Customers Grid */}
            {isLoading ? (
              <div className="text-center py-20">
                <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg shadow-blue-500/50" />
                <p className="text-muted-foreground mt-6 text-lg">Yuklanmoqda...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-20 bg-gradient-to-br from-card/50 to-muted/30 rounded-2xl border border-border/50 backdrop-blur-sm">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                  <User className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-lg">
                  {search ? 'Mijoz topilmadi' : 'Hali mijozlar yo\'q'}
                </p>
                {!search && (
                  <Button
                    onClick={() => setShowAddDialog(true)}
                    className="mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Birinchi mijozni qo'shish
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {filteredCustomers.map((customer) => (
                    <motion.div
                      key={customer.id}
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -20 }}
                      whileHover={{ scale: 1.02, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="group relative bg-gradient-to-br from-card via-card to-card/80 border border-border/50 rounded-2xl p-6 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 backdrop-blur-sm overflow-hidden"
                    >
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>
                      
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-xl group-hover:shadow-blue-500/40 transition-all duration-300">
                              <span className="text-white font-bold text-xl">
                                {customer.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground text-lg group-hover:text-blue-600 transition-colors">
                                {highlightText(customer.name, search)}
                              </h3>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                Mijoz
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(customer)}
                              className="p-2.5 hover:bg-blue-500/10 rounded-xl transition-all duration-200 group/btn"
                            >
                              <Edit2 className="w-4 h-4 text-blue-600 group-hover/btn:scale-110 transition-transform" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(customer)}
                              className="p-2.5 hover:bg-red-500/10 rounded-xl transition-all duration-200 group/btn"
                            >
                              <Trash2 className="w-4 h-4 text-red-600 group-hover/btn:scale-110 transition-transform" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm bg-muted/30 rounded-xl p-3 group-hover:bg-muted/50 transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                              <Phone className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-foreground font-medium">{highlightText(customer.phone, search)}</span>
                          </div>
                          {customer.address && (
                            <div className="flex items-center gap-3 text-sm bg-muted/30 rounded-xl p-3 group-hover:bg-muted/50 transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-purple-600" />
                              </div>
                              <div className="flex-1">
                                <span className="text-foreground">{highlightText(customer.address, search)}</span>
                              </div>
                            </div>
                          )}
                          {customer.location && customer.location.lat !== 0 && customer.location.lng !== 0 && (
                            <div 
                              onClick={() => {
                                window.open(`https://www.google.com/maps?q=${customer.location.lat},${customer.location.lng}`, '_blank');
                              }}
                              className="flex items-center gap-3 text-sm bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl p-3 cursor-pointer hover:from-green-500/20 hover:to-emerald-500/20 border border-green-500/30 hover:border-green-500/50 transition-all duration-200 group/location"
                            >
                              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center group-hover/location:scale-110 transition-transform">
                                <Navigation className="w-4 h-4 text-green-600" />
                              </div>
                              <div className="flex-1">
                                <div className="text-green-700 dark:text-green-400 font-medium">Joylashuv</div>
                                <div className="text-xs text-green-600/80 dark:text-green-500/80">Xaritada ochish uchun bosing</div>
                              </div>
                            </div>
                          )}
                          {customer.carModel && (
                            <div className="flex items-center gap-3 text-sm bg-muted/30 rounded-xl p-3 group-hover:bg-muted/50 transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                                <Car className="w-4 h-4 text-pink-600" />
                              </div>
                              <span className="text-foreground">{highlightText(customer.carModel, search)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-md bg-gradient-to-br from-card via-card to-muted/20 border-border/50 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                {editingCustomer ? <Edit2 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
              </div>
              {editingCustomer ? 'Mijozni tahrirlash' : 'Yangi mijoz qo\'shish'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Ism <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mijoz ismi"
                className="w-full px-4 py-3 rounded-xl bg-background/50 backdrop-blur-sm border border-border hover:border-blue-500/50 focus:border-blue-500 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Phone className="w-4 h-4 text-purple-600" />
                Telefon raqami <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="+998 90 123 45 67"
                className="w-full px-4 py-3 rounded-xl bg-background/50 backdrop-blur-sm border border-border hover:border-purple-500/50 focus:border-purple-500 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-pink-600" />
                Uy manzili va joylashuv
              </label>
              <div className="space-y-2">
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Toshkent shahar, Yunusobod tumani... yoki link kiriting"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-background/50 backdrop-blur-sm border border-border hover:border-pink-500/50 focus:border-pink-500 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-pink-500/20 transition-all resize-none"
                />
                
                {/* Location link input - Telegram/Google Maps */}
                <div className="space-y-2">
                  <input
                    type="text"
                    value={locationLink}
                    onChange={async (e) => {
                      const link = e.target.value.trim();
                      setLocationLink(link);
                      
                      console.log('[CustomerData] Location link input:', link);
                      
                      // Parse location from link
                      if (link) {
                        let lat = null;
                        let lng = null;
                        
                        try {
                          // Check for shortened Google Maps link - use backend API
                          if (link.includes('maps.app.goo.gl') || link.includes('goo.gl/maps')) {
                            console.log('[CustomerData] Shortened Google Maps link detected - using backend API');
                            toast.info('Link tekshirilmoqda...');
                            
                            try {
                              const response = await fetch(`${API_BASE_URL}/api/resolve-location`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ url: link })
                              });
                              
                              const data = await response.json();
                              console.log('[CustomerData] Backend response:', data);
                              
                              if (data.success && data.location) {
                                lat = data.location.lat;
                                lng = data.location.lng;
                                console.log('[CustomerData] Got coordinates from backend - lat:', lat, 'lng:', lng);
                              } else {
                                toast.error(data.error || 'Koordinatalar topilmadi');
                                return;
                              }
                            } catch (fetchError) {
                              console.error('[CustomerData] Backend fetch error:', fetchError);
                              toast.error('Linkni tekshirib bo\'lmadi');
                              return;
                            }
                          } else {
                            // Parse other link types directly
                            const url = new URL(link);
                            
                            console.log('[CustomerData] Parsed URL:', url.hostname);
                            console.log('[CustomerData] Search params:', url.searchParams.toString());
                            console.log('[CustomerData] Full path:', url.pathname);
                            
                            // Google Maps regular links
                            if (link.includes('google.com/maps') || link.includes('maps.google.com')) {
                              // Format 1: ?q=lat,lng
                              const qParam = url.searchParams.get('q');
                              console.log('[CustomerData] Google Maps q param:', qParam);
                              if (qParam && qParam.includes(',')) {
                                const [latStr, lngStr] = qParam.split(',');
                                lat = parseFloat(latStr.trim());
                                lng = parseFloat(lngStr.trim());
                              }
                              
                              // Format 2: /@lat,lng in path or URL
                              if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                                const atMatch = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                                if (atMatch) {
                                  lat = parseFloat(atMatch[1]);
                                  lng = parseFloat(atMatch[2]);
                                  console.log('[CustomerData] Extracted from @ in path - lat:', lat, 'lng:', lng);
                                }
                              }
                              
                              // Format 3: /place/.../@lat,lng
                              if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                                const placeMatch = link.match(/\/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                                if (placeMatch) {
                                  lat = parseFloat(placeMatch[1]);
                                  lng = parseFloat(placeMatch[2]);
                                  console.log('[CustomerData] Extracted from place - lat:', lat, 'lng:', lng);
                                }
                              }
                            }
                            // Telegram ?lat=...&lon=...
                            else if (link.includes('t.me')) {
                              const latParam = url.searchParams.get('lat');
                              const lonParam = url.searchParams.get('lon');
                              console.log('[CustomerData] Telegram lat:', latParam, 'lon:', lonParam);
                              if (latParam && lonParam) {
                                lat = parseFloat(latParam);
                                lng = parseFloat(lonParam);
                              }
                            }
                            // 2GIS ?m=lng,lat (2GIS uses lng,lat order)
                            else if (link.includes('2gis')) {
                              const mParam = url.searchParams.get('m');
                              console.log('[CustomerData] 2GIS m param:', mParam);
                              if (mParam && mParam.includes(',')) {
                                const [lngStr, latStr] = mParam.split(',');
                                lat = parseFloat(latStr.trim());
                                lng = parseFloat(lngStr.trim());
                              }
                            }
                          }
                          
                          console.log('[CustomerData] Parsed coordinates - lat:', lat, 'lng:', lng);
                          
                          if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                            const newLocation = { lat, lng };
                            setLocation(newLocation);
                            console.log('[CustomerData] Location set:', newLocation);
                            toast.success('Joylashuv linkdan olindi');
                          } else {
                            console.warn('[CustomerData] Invalid coordinates parsed');
                            toast.error('Link noto\'g\'ri formatda yoki koordinatalar topilmadi');
                          }
                        } catch (e) {
                          console.error('[CustomerData] URL parse error:', e);
                          toast.error('Link noto\'g\'ri formatda');
                        }
                      } else {
                        setLocation(null);
                        console.log('[CustomerData] Location cleared');
                      }
                    }}
                    placeholder="Google Maps yoki Telegram linkini kiriting"
                    className="w-full px-4 py-3 rounded-xl bg-background/50 backdrop-blur-sm border border-border hover:border-blue-500/50 focus:border-blue-500 text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>Qo'llab-quvvatlanadigan formatlar:</span>
                    </p>
                    <ul className="ml-4 space-y-0.5 text-muted-foreground/80">
                      <li>• Telegram: Joylashuvni forward qiling va linkni kiriting</li>
                      <li>• Google Maps: Har qanday link (qisqa yoki to'liq)</li>
                      <li>• 2GIS: Joyni oching va brauzer linkini nusxalang</li>
                    </ul>
                  </div>
                  {location && (
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>Joylashuv: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            setLocation({
                              lat: position.coords.latitude,
                              lng: position.coords.longitude,
                            });
                            setLocationLink('');
                            toast.success('Joylashuv olindi');
                          },
                          (error) => {
                            console.error('Geolocation error:', error);
                            toast.error('Joylashuvni olishda xatolik');
                          }
                        );
                      } else {
                        toast.error('Brauzer joylashuvni qo\'llab-quvvatlamaydi');
                      }
                    }}
                    className="flex-1 border-pink-500/30 hover:bg-pink-500/10 hover:border-pink-500/50 text-pink-600"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Hozirgi joylashuv
                  </Button>
                  {location && location.lat !== 0 && location.lng !== 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        window.open(`https://www.google.com/maps?q=${location.lat},${location.lng}`, '_blank');
                      }}
                      className="border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50 text-blue-600"
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      Xaritada
                    </Button>
                  )}
                </div>
                
                {location && location.lat !== 0 && location.lng !== 0 && (
                  <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    <span className="text-xs text-green-600 font-medium">
                      📍 Joylashuv saqlandi: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setLocation(null);
                        setLocationLink('');
                      }}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      O'chirish
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Car className="w-4 h-4 text-orange-600" />
                Mashina modeli
              </label>
              <input
                type="text"
                value={carModel}
                onChange={(e) => setCarModel(e.target.value)}
                placeholder="Chevrolet Nexia, Toyota Camry..."
                className="w-full px-4 py-3 rounded-xl bg-background/50 backdrop-blur-sm border border-border hover:border-orange-500/50 focus:border-orange-500 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                className="flex-1 border-border hover:bg-muted"
                disabled={isSaving}
              >
                Bekor qilish
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transition-all duration-300"
                disabled={isSaving}
              >
                {isSaving ? 'Saqlanmoqda...' : editingCustomer ? 'Yangilash' : 'Qo\'shish'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingCustomer} onOpenChange={() => setDeletingCustomer(null)}>
        <DialogContent className="max-w-md bg-gradient-to-br from-card via-card to-red-500/5 border-red-500/20 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              Mijozni o'chirish
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-foreground mb-2">
                Ushbu mijozni o'chirmoqchimisiz?
              </p>
              {deletingCustomer && (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-foreground">{deletingCustomer.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{deletingCustomer.phone}</span>
                  </div>
                  {deletingCustomer.carModel && (
                    <div className="flex items-center gap-2 text-sm">
                      <Car className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{deletingCustomer.carModel}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              Bu amalni ortga qaytarib bo'lmaydi.
            </p>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingCustomer(null)}
                className="flex-1 border-border hover:bg-muted"
                disabled={isDeleting}
              >
                Bekor qilish
              </Button>
              <Button
                type="button"
                onClick={() => deletingCustomer && handleDelete(deletingCustomer.id)}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-500/50 hover:shadow-xl hover:shadow-red-500/60 transition-all duration-300"
                disabled={isDeleting}
              >
                {isDeleting ? 'O\'chirilmoqda...' : 'Ha, o\'chirish'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
