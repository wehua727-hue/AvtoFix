import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import Sidebar from '@/components/Layout/Sidebar';
import Navbar from '@/components/Layout/Navbar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { 
  Plus, Pencil, Trash2, Loader2, Users, Sparkles,
  Crown, Shield, Check, UserCog
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  phone: string;
  address: string;
  role: string;
  createdBy?: string;
  createdByRole?: "egasi" | "admin";
  subscriptionType?: "oddiy" | "cheksiz";
  subscriptionEndDate?: string;
  isBlocked?: boolean;
  createdAt: string;
}

const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'file:') return 'http://127.0.0.1:5174';
  return import.meta.env.VITE_API_URL || '';
})();

const ROLES = [
  { value: 'egasi', label: 'Egasi', icon: Crown, color: 'purple' },
  { value: 'admin', label: 'Admin', icon: Shield, color: 'blue' },
  { value: 'xodim', label: 'Xodim', icon: UserCog, color: 'green' },
];

const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  let phone = digits;
  if (!phone.startsWith('998') && phone.length > 0) phone = '998' + phone;
  phone = phone.slice(0, 12);
  if (phone.length === 0) return '';
  if (phone.length <= 3) return '+' + phone;
  if (phone.length <= 5) return '+' + phone.slice(0, 3) + ' (' + phone.slice(3);
  if (phone.length <= 8) return '+' + phone.slice(0, 3) + ' (' + phone.slice(3, 5) + ') ' + phone.slice(5);
  if (phone.length <= 10) return '+' + phone.slice(0, 3) + ' (' + phone.slice(3, 5) + ') ' + phone.slice(5, 8) + '-' + phone.slice(8);
  return '+' + phone.slice(0, 3) + ' (' + phone.slice(3, 5) + ') ' + phone.slice(5, 8) + '-' + phone.slice(8, 10) + '-' + phone.slice(10);
};

const getPhoneDigits = (formatted: string): string => formatted.replace(/\D/g, '');

export default function UsersPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isLight = theme === 'light';
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  
  const hasAccess = currentUser && (currentUser.role === 'egasi' || currentUser.role === 'admin');
  const canAddUsers = currentUser?.role === 'egasi' || currentUser?.role === 'admin'; // Egasi va admin qo'sha oladi
  
  useEffect(() => {
    if (currentUser && !hasAccess) {
      toast({ title: 'Ruxsat yo\'q', description: 'Bu sahifaga kirish huquqingiz yo\'q', variant: 'destructive' });
      navigate('/', { replace: true });
    }
  }, [currentUser, hasAccess, navigate, toast]);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formRole, setFormRole] = useState('admin');
  const [formSubscriptionType, setFormSubscriptionType] = useState<'oddiy' | 'cheksiz'>('cheksiz');
  const [formSubscriptionEndDate, setFormSubscriptionEndDate] = useState('');

  const fetchUsers = async () => {
    try {
      // Filtrlash parametrlarini qo'shish
      const params = new URLSearchParams();
      if (currentUser?.id) params.append('userId', currentUser.id);
      if (currentUser?.role) params.append('userRole', currentUser.role);
      
      const res = await fetch(`${API_BASE}/api/users?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      toast({ title: 'Xatolik', description: 'Yuklashda xatolik', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (currentUser) fetchUsers(); }, [currentUser]);

  const resetForm = () => {
    setFormName(''); setFormPhone(''); setFormPassword(''); setFormAddress(''); setFormRole('admin');
    setFormSubscriptionType('cheksiz'); setFormSubscriptionEndDate('');
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formPhone.trim() || !formPassword.trim()) {
      toast({ title: 'Xatolik', description: 'Majburiy maydonlar', variant: 'destructive' });
      return;
    }
    if (formSubscriptionType === 'oddiy' && !formSubscriptionEndDate) {
      toast({ title: 'Xatolik', description: 'Oddiy tarif uchun tugash sanasini kiriting', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body: any = { 
        name: formName.trim(), phone: getPhoneDigits(formPhone), password: formPassword, 
        address: formAddress.trim(), role: formRole, subscriptionType: formSubscriptionType,
        ownerId: currentUser?.role === 'egasi' ? currentUser.id : undefined,
        createdBy: currentUser?.id, // Kim yaratgan
        createdByRole: currentUser?.role, // Yaratuvchining roli
      };
      if (formSubscriptionType === 'oddiy' && formSubscriptionEndDate) body.subscriptionEndDate = formSubscriptionEndDate;
      
      const res = await fetch(`${API_BASE}/api/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) { toast({ title: 'Muvaffaqiyat' }); setIsAddOpen(false); resetForm(); fetchUsers(); }
      else toast({ title: 'Xatolik', description: data.error, variant: 'destructive' });
    } catch { toast({ title: 'Xatolik', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editingUser || !formName.trim() || !formPhone.trim()) return;
    if (formSubscriptionType === 'oddiy' && !formSubscriptionEndDate) {
      toast({ title: 'Xatolik', description: 'Oddiy tarif uchun tugash sanasini kiriting', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body: any = { name: formName.trim(), phone: getPhoneDigits(formPhone), address: formAddress.trim(), role: formRole, subscriptionType: formSubscriptionType };
      if (formPassword.trim()) body.password = formPassword;
      if (formSubscriptionType === 'oddiy' && formSubscriptionEndDate) body.subscriptionEndDate = formSubscriptionEndDate;
      else if (formSubscriptionType === 'cheksiz') { body.subscriptionEndDate = null; body.isBlocked = false; }
      
      const res = await fetch(`${API_BASE}/api/users/${editingUser.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) { toast({ title: 'Muvaffaqiyat' }); setIsEditOpen(false); setEditingUser(null); resetForm(); fetchUsers(); }
      else toast({ title: 'Xatolik', description: data.error, variant: 'destructive' });
    } catch { toast({ title: 'Xatolik', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === currentUser?.id) return;
    setChangingRoleId(userId);
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: newRole }) });
      const data = await res.json();
      if (data.success) setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch {}
    finally { setChangingRoleId(null); }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });

  const handleDeleteClick = (user: User) => {
    if (user.id === currentUser?.id) { toast({ title: 'Xatolik', description: 'O\'zingizni o\'chira olmaysiz', variant: 'destructive' }); return; }
    setDeleteConfirm({ open: true, user });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.user) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${deleteConfirm.user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast({ title: 'Muvaffaqiyat', description: 'Foydalanuvchi o\'chirildi' }); fetchUsers(); }
    } catch { toast({ title: 'Xatolik', variant: 'destructive' }); }
    finally { setDeleteConfirm({ open: false, user: null }); }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user); setFormName(user.name); setFormPhone(formatPhoneNumber(user.phone));
    setFormPassword(''); setFormAddress(user.address); setFormRole(user.role);
    setFormSubscriptionType(user.subscriptionType || 'cheksiz');
    setFormSubscriptionEndDate(user.subscriptionEndDate ? user.subscriptionEndDate.split('T')[0] : '');
    setIsEditOpen(true);
  };

  const colors: Record<string, { bg: string; text: string; border: string; hover: string }> = {
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', hover: 'hover:bg-purple-500/30' },
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', hover: 'hover:bg-blue-500/30' },
    green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', hover: 'hover:bg-green-500/30' },
  };

  const RoleBadge = ({ user }: { user: User }) => {
    const roleConfig = ROLES.find(r => r.value === user.role) || ROLES[1];
    const Icon = roleConfig.icon;
    const c = colors[roleConfig.color];
    const isMe = user.id === currentUser?.id;
    // Egasi va admin o'zi qo'shganlarning rolini o'zgartira oladi
    const canChangeRole = (currentUser?.role === 'egasi' || currentUser?.role === 'admin') && !isMe;

    if (!canChangeRole) {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
          <Icon className="w-3.5 h-3.5" />{roleConfig.label}
        </span>
      );
    }

    // Admin faqat admin va xodim rollarini tanlashi mumkin
    const availableRoles = currentUser?.role === 'egasi' ? ROLES : ROLES.filter(r => r.value !== 'egasi');

    return (
      <Popover>
        <PopoverTrigger asChild>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer ${c.bg} ${c.text} ${c.border} ${c.hover}`}>
            {changingRoleId === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
            {roleConfig.label}
          </motion.button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1 bg-popover border-border" align="start">
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Rolni o'zgartirish</p>
          {availableRoles.map(role => {
            const RIcon = role.icon; const sel = role.value === user.role; const rc = colors[role.color];
            return (
              <motion.button key={role.value} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}
                onClick={() => !sel && handleRoleChange(user.id, role.value)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm ${sel ? `${rc.bg} ${rc.text}` : 'text-muted-foreground hover:bg-muted'}`}>
                <RIcon className={`w-4 h-4 ${sel ? rc.text : 'text-muted-foreground'}`} />
                <span className="flex-1 text-left">{role.label}</span>
                {sel && <Check className="w-4 h-4" />}
              </motion.button>
            );
          })}
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isLight ? 'bg-gray-50' : 'bg-gray-900/80'}`}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onCollapsedChange={setSidebarCollapsed} />
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed}
        rightSlot={canAddUsers ? (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button onClick={() => { resetForm(); setIsAddOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm px-3 py-1.5 h-auto">
              <Plus className="h-4 w-4 mr-1" />Qo'shish
            </Button>
          </motion.div>
        ) : null}
      />
      
      <main className={`pt-12 sm:pt-14 lg:pt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-80'}`}>
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
          {/* Header with animation */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
            <div className={`p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 border ${isLight ? 'border-purple-300' : 'border-purple-500/20'}`}>
              <Users className={`w-6 h-6 ${isLight ? 'text-purple-600' : 'text-purple-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-xl sm:text-2xl font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>Foydalanuvchilar</h1>
                <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
              </div>
              <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-muted-foreground'}`}>{users.length} ta foydalanuvchi</p>
            </div>
          </motion.div>

          {loading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-20">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-purple-500/20 rounded-full" />
                <div className="absolute inset-0 w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            </motion.div>
          ) : users.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className={`${isLight ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'}`}><CardContent className={`py-20 text-center ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>Topilmadi</CardContent></Card>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className={`overflow-hidden shadow-sm ${isLight ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'}`}>
                <table className="w-full">
                  <thead>
                    <tr className={`${isLight ? 'border-b border-gray-200 bg-gray-50' : 'border-b border-white/10'}`}>
                      <th className={`text-left p-3 text-xs uppercase ${isLight ? 'text-gray-600' : 'text-gray-500'}`}>Ism</th>
                      <th className={`text-left p-3 text-xs uppercase ${isLight ? 'text-gray-600' : 'text-gray-500'}`}>Telefon</th>
                      <th className={`text-left p-3 text-xs uppercase hidden md:table-cell ${isLight ? 'text-gray-600' : 'text-gray-500'}`}>Manzil</th>
                      <th className={`text-left p-3 text-xs uppercase ${isLight ? 'text-gray-600' : 'text-gray-500'}`}>Rol</th>
                      <th className={`text-center p-3 text-xs uppercase ${isLight ? 'text-gray-600' : 'text-gray-500'}`}>Amallar</th>
                    </tr>
                  </thead>
                  <tbody className={`${isLight ? 'divide-y divide-gray-100' : 'divide-y divide-white/5'}`}>
                    <AnimatePresence mode="popLayout">
                      {users.map((user, i) => {
                        const isBlocked = user.isBlocked || (user.subscriptionType === 'oddiy' && user.subscriptionEndDate && new Date(user.subscriptionEndDate) < new Date());
                        return (
                          <motion.tr 
                            key={user.id} 
                            layout 
                            initial={{ opacity: 0, y: 20 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, x: -100 }} 
                            transition={{ delay: i * 0.05 }} 
                            className={`group transition-colors ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/5'} ${isBlocked ? (isLight ? 'bg-red-50 border-l-4 border-red-500' : 'bg-red-900/10 border-l-4 border-red-600') : ''}`}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${isBlocked ? 'text-red-500' : (isLight ? 'text-gray-800' : 'text-white')}`}>{user.name}</span>
                                {isBlocked && <span className={`px-2 py-0.5 text-xs rounded ${isLight ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-red-900/30 text-red-400 border border-red-600/30'}`}>Bloklangan</span>}
                              </div>
                            </td>
                            <td className={`p-3 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{user.phone}</td>
                            <td className={`p-3 hidden md:table-cell ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>{user.address || '—'}</td>
                            <td className="p-3">
                              <div className="flex flex-col gap-1">
                                <RoleBadge user={user} />
                                {user.subscriptionType === 'oddiy' && user.subscriptionEndDate && (
                                  <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>{new Date(user.subscriptionEndDate).toLocaleDateString('uz-UZ')} gacha</span>
                                )}
                                {user.subscriptionType === 'cheksiz' && <span className="text-xs text-green-500">Cheksiz</span>}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex justify-end gap-2">
                                {/* Egasi tahrirlashi mumkin, admin faqat o'zi qo'shganlarni (o'zini emas) */}
                                {(currentUser?.role === 'egasi' || (currentUser?.role === 'admin' && user.id !== currentUser?.id)) && (
                                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)} className={`h-8 w-8 ${isLight ? 'text-gray-500 hover:text-gray-800 hover:bg-gray-100' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </motion.div>
                                )}
                                {/* Egasi va admin o'chirishi mumkin (o'zini emas) */}
                                {(currentUser?.role === 'egasi' || currentUser?.role === 'admin') && user.id !== currentUser?.id && (
                                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(user)} className={`h-8 w-8 ${isLight ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'}`}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </motion.div>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </Card>
            </motion.div>
          )}

          {/* Add Dialog */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogContent className="bg-gray-900 border-white/10 max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-white">Yangi foydalanuvchi</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label className="text-gray-400">Ism *</Label><Input value={formName} onChange={e => setFormName(e.target.value)} className="mt-1 bg-white/5 border-white/10" /></div>
                <div><Label className="text-gray-400">Telefon *</Label><Input value={formPhone} onChange={e => setFormPhone(formatPhoneNumber(e.target.value))} placeholder="+998 (XX) XXX-XX-XX" className="mt-1 bg-white/5 border-white/10" /></div>
                <div><Label className="text-gray-400">Parol *</Label><Input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} className="mt-1 bg-white/5 border-white/10" /></div>
                <div><Label className="text-gray-400">Manzil</Label><Input value={formAddress} onChange={e => setFormAddress(e.target.value)} className="mt-1 bg-white/5 border-white/10" /></div>
                <div><Label className="text-gray-400">Rol</Label>
                  <Select value={formRole} onValueChange={setFormRole}><SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {/* Admin faqat admin va xodim qo'sha oladi, egasi hammasini */}
                      {ROLES.filter(r => currentUser?.role === 'egasi' || r.value !== 'egasi').map(r => (
                        <SelectItem key={r.value} value={r.value}><span className="flex items-center gap-2"><r.icon className="w-4 h-4" />{r.label}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Obuna turi - faqat egasi ko'radi */}
                {currentUser?.role === 'egasi' && (
                  <>
                    <div className="border-t border-white/10 pt-4">
                      <Label className="text-gray-400">Obuna turi *</Label>
                      <Select value={formSubscriptionType} onValueChange={(v: 'oddiy' | 'cheksiz') => { setFormSubscriptionType(v); if (v === 'cheksiz') setFormSubscriptionEndDate(''); }}>
                        <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cheksiz">Cheksiz - Hech qachon bloklanmaydi</SelectItem>
                          <SelectItem value="oddiy">Oddiy - Muddatli obuna</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formSubscriptionType === 'oddiy' && (
                      <div><Label className="text-gray-400">Obuna tugash sanasi *</Label>
                        <Input type="date" value={formSubscriptionEndDate} onChange={e => setFormSubscriptionEndDate(e.target.value)} className="mt-1 bg-white/5 border-white/10" min={new Date().toISOString().split('T')[0]} />
                        <p className="text-xs text-gray-500 mt-1">Ushbu sanada akkaunt bloklanadi</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              <Button onClick={handleAdd} disabled={saving} className="w-full mt-4 bg-purple-600 hover:bg-purple-700">{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Qo'shish</Button>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="bg-gray-900 border-white/10 max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-white">Tahrirlash</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label className="text-gray-400">Ism *</Label><Input value={formName} onChange={e => setFormName(e.target.value)} className="mt-1 bg-white/5 border-white/10" /></div>
                <div><Label className="text-gray-400">Telefon *</Label><Input value={formPhone} onChange={e => setFormPhone(formatPhoneNumber(e.target.value))} placeholder="+998 (XX) XXX-XX-XX" className="mt-1 bg-white/5 border-white/10" /></div>
                <div><Label className="text-gray-400">Yangi parol</Label><Input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} className="mt-1 bg-white/5 border-white/10" /></div>
                <div><Label className="text-gray-400">Manzil</Label><Input value={formAddress} onChange={e => setFormAddress(e.target.value)} className="mt-1 bg-white/5 border-white/10" /></div>
                {currentUser?.role === 'egasi' && (
                  <>
                    <div><Label className="text-gray-400">Rol</Label>
                      <Select value={formRole} onValueChange={setFormRole}><SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}><span className="flex items-center gap-2"><r.icon className="w-4 h-4" />{r.label}</span></SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="border-t border-white/10 pt-4">
                      <Label className="text-gray-400">Obuna turi *</Label>
                      <Select value={formSubscriptionType} onValueChange={(v: 'oddiy' | 'cheksiz') => { setFormSubscriptionType(v); if (v === 'cheksiz') setFormSubscriptionEndDate(''); }}>
                        <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cheksiz">Cheksiz - Hech qachon bloklanmaydi</SelectItem>
                          <SelectItem value="oddiy">Oddiy - Muddatli obuna</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formSubscriptionType === 'oddiy' && (
                      <div><Label className="text-gray-400">Obuna tugash sanasi *</Label>
                        <Input type="date" value={formSubscriptionEndDate} onChange={e => setFormSubscriptionEndDate(e.target.value)} className="mt-1 bg-white/5 border-white/10" min={new Date().toISOString().split('T')[0]} />
                        <p className="text-xs text-gray-500 mt-1">Ushbu sanada akkaunt bloklanadi</p>
                      </div>
                    )}
                    {editingUser?.isBlocked && (
                      <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                        <p className="text-sm text-red-400 font-medium">⚠️ Akkaunt bloklangan</p>
                        <p className="text-xs text-gray-400 mt-1">Obuna sanasini o'zgartiring yoki cheksiz tarifga o'tkazing</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              <Button onClick={handleEdit} disabled={saving} className="w-full mt-4 bg-purple-600 hover:bg-purple-700">{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Saqlash</Button>
            </DialogContent>
          </Dialog>

          <ConfirmDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ open, user: null })} title="Foydalanuvchini o'chirish"
            description={deleteConfirm.user ? `${deleteConfirm.user.name} ni o'chirmoqchimisiz? Bu amalni bekor qilib bo'lmaydi.` : ''}
            confirmText="O'chirish" cancelText="Bekor qilish" onConfirm={handleDeleteConfirm} variant="destructive" />
        </div>
      </main>
    </div>
  );
}
