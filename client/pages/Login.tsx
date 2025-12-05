import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Phone, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const { toast } = useToast();
  
  const [phone, setPhone] = useState('');
  const [displayPhone, setDisplayPhone] = useState('+998 ');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
            <img 
              src="/white text.png" 
              alt="AvtoFix Logo" 
              className="h-24 w-auto mx-auto"
              style={{ 
                filter: 'drop-shadow(0 4px 12px rgba(220,38,38,0.6)) brightness(1.4) contrast(1.5)',
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.png';
              }}
            />
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
              <p className="text-xs text-gray-500">Masalan: +998 (91) 071 28 28</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">Parol</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
