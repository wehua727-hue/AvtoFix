import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Phone, Lock, Eye, EyeOff, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const { toast } = useToast();
  
  const [phone, setPhone] = useState('');
  const [displayPhone, setDisplayPhone] = useState('+998 ');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Telefon raqamni formatlash: +998 (XX) XXX XX XX
  const formatPhoneNumber = (value: string) => {
    // Faqat raqamlarni olish
    const numbers = value.replace(/\D/g, '');
    
    // 998 dan keyingi raqamlarni olish
    const phoneNumbers = numbers.startsWith('998') ? numbers.slice(3) : numbers;
    
    // Maksimal 9 ta raqam
    const limitedNumbers = phoneNumbers.slice(0, 9);
    
    // Formatlash
    let formatted = '+998 ';
    
    if (limitedNumbers.length > 0) {
      formatted += '(';
      formatted += limitedNumbers.slice(0, 2);
      
      if (limitedNumbers.length > 2) {
        formatted += ') ';
        formatted += limitedNumbers.slice(2, 5);
        
        if (limitedNumbers.length > 5) {
          formatted += ' ';
          formatted += limitedNumbers.slice(5, 7);
          
          if (limitedNumbers.length > 7) {
            formatted += ' ';
            formatted += limitedNumbers.slice(7, 9);
          }
        }
      }
    }
    
    return { formatted, clean: limitedNumbers };
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Agar foydalanuvchi +998 ni o'chirmoqchi bo'lsa, to'xtatish
    if (value.length < 5) {
      setDisplayPhone('+998 ');
      setPhone('');
      return;
    }
    
    const { formatted, clean } = formatPhoneNumber(value);
    setDisplayPhone(formatted);
    setPhone(clean);
  };

  // Agar allaqachon tizimga kirgan bo'lsa - redirect
  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim() || !password.trim()) {
      toast({
        title: 'Xatolik',
        description: 'Telefon raqam va parolni kiriting',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Backend uchun turli formatlarni sinab ko'ramiz
      const phoneFormats = [
        phone.trim(),                    // 910712828
        `+998${phone.trim()}`,          // +998910712828
        `998${phone.trim()}`,           // 998910712828
      ];
      
      let loginSuccess = false;
      let lastError: any = null;
      
      // Har bir formatni sinab ko'ramiz
      for (const phoneFormat of phoneFormats) {
        try {
          await login(phoneFormat, password);
          loginSuccess = true;
          break;
        } catch (err) {
          lastError = err;
          continue;
        }
      }
      
      if (loginSuccess) {
        toast({
          title: 'Muvaffaqiyatli',
          description: 'Tizimga kirdingiz',
        });
        navigate('/', { replace: true });
      } else {
        throw lastError;
      }
    } catch (error: any) {
      console.error('[Login] Error:', error);
      toast({
        title: 'Kirish xatosi',
        description: error.message || 'Telefon raqam yoki parol noto\'g\'ri',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <Card className="w-full max-w-md bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border-gray-700">
        <CardHeader className="text-center">
          <div className="mx-auto mb-6">
            <h1 className="text-4xl font-bold text-white drop-shadow-[0_0_15px_rgba(220,38,38,0.6)]">
              AvtoFix
            </h1>
          </div>
          <CardTitle className="text-2xl text-white">Tizimga kirish</CardTitle>
          <CardDescription className="text-gray-400">
            Telefon raqam va parolni kiriting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-300">Telefon raqami</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+998 (XX) XXX XX XX"
                  value={displayPhone}
                  onChange={handlePhoneChange}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  disabled={isLoading}
                  autoComplete="tel"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">Parol</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-white/5 border-white/10 text-white"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-0" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Kirish...
                </>
              ) : (
                'Kirish'
              )}
            </Button>

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-center text-sm text-gray-400 mb-3">
                Bironbir muammo bo'lsa bog'laning
              </p>
              <div className="flex items-center justify-center gap-4">
                <a 
                  href="tel:+998910712828" 
                  className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  <Phone className="h-4 w-4 text-red-400" />
                  +998 (91) 071 28 28
                </a>
                <span className="text-gray-600">|</span>
                <a 
                  href="https://t.me/UmidjonAsadov" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  <MessageCircle className="h-4 w-4 text-blue-400" />
                  Telegram
                </a>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
