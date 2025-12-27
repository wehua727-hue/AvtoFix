import { Phone, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function AccountBlocked() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Akkaunt bloklangan
          </h1>

          {/* Message */}
          <p className="text-muted-foreground mb-6">
            Obuna muddati tugagan yoki to'lov amalga oshirilmagan. 
            Iltimos, quyidagi raqamga qo'ng'iroq qiling va to'lovni amalga oshiring.
          </p>

          {/* Phone */}
          <div className="bg-muted rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center gap-3">
              <Phone className="w-6 h-6 text-primary" />
              <a 
                href="tel:+998910712828"
                className="text-2xl font-bold text-primary hover:underline"
              >
                +998 91 071 28 28
              </a>
            </div>
          </div>

          {/* Info */}
          <p className="text-sm text-muted-foreground mb-6">
            To'lovni amalga oshirgandan so'ng, akkauntingiz avtomatik ravishda faollashtiriladi.
          </p>

          {/* Button */}
          <Button
            onClick={() => navigate('/login')}
            variant="outline"
            className="w-full"
          >
            Kirish sahifasiga qaytish
          </Button>
        </div>
      </div>
    </div>
  );
}
