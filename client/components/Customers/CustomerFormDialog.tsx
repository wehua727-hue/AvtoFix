import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { ICustomer } from '@shared/customer-types';

// API base URL - работает для веб и Electron
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  if (window.location.protocol === 'file:') return 'http://127.0.0.1:5174';
  return import.meta.env.VITE_API_URL || '';
})();

const customerSchema = z.object({
  firstName: z.string().min(1, 'Ismni kiriting'),
  lastName: z.string().min(1, 'Familiyani kiriting'),
  phone: z.string().optional(),
  birthDate: z.string().min(1, 'Tug\'ilgan kunni tanlang'),
  notes: z.string().optional(),
});

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: ICustomer | null;
  onSuccess: () => void;
}

export default function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSuccess,
}: CustomerFormDialogProps) {
  const { toast } = useToast();
  const [displayPhone, setDisplayPhone] = useState('+998 ');
  const [cleanPhone, setCleanPhone] = useState('');
  
  const form = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      birthDate: '',
      notes: '',
    },
  });

  // Telefon raqamni formatlash: +998 (XX) XXX XX XX
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const phoneNumbers = numbers.startsWith('998') ? numbers.slice(3) : numbers;
    const limitedNumbers = phoneNumbers.slice(0, 9);
    
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
    
    if (value.length < 5) {
      setDisplayPhone('+998 ');
      setCleanPhone('');
      form.setValue('phone', '');
      return;
    }
    
    const { formatted, clean } = formatPhoneNumber(value);
    setDisplayPhone(formatted);
    setCleanPhone(clean);
    form.setValue('phone', clean ? `+998${clean}` : '');
  };

  useEffect(() => {
    if (customer) {
      // Telefon raqamni formatlash
      if (customer.phone) {
        const numbers = customer.phone.replace(/\D/g, '');
        const phoneNumbers = numbers.startsWith('998') ? numbers.slice(3) : numbers;
        const { formatted } = formatPhoneNumber(phoneNumbers);
        setDisplayPhone(formatted);
        setCleanPhone(phoneNumbers);
      } else {
        setDisplayPhone('+998 ');
        setCleanPhone('');
      }
      
      form.reset({
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone || '',
        birthDate: customer.birthDate.split('T')[0],
        notes: customer.notes || '',
      });
    } else {
      setDisplayPhone('+998 ');
      setCleanPhone('');
      form.reset({
        firstName: '',
        lastName: '',
        phone: '',
        birthDate: '',
        notes: '',
      });
    }
  }, [customer, form]);

  const onSubmit = async (values: any) => {
    try {
      // localStorage dan userId ni olish
      const userStr = localStorage.getItem('user');
      const userId = userStr ? JSON.parse(userStr).id : null;
      
      const url = customer
        ? `${API_BASE}/api/customers/${customer._id}`
        : `${API_BASE}/api/customers`;
      
      const method = customer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId || '',
        },
        body: JSON.stringify({ ...values, userId }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Muvaffaqiyat',
          description: customer ? 'Mijoz yangilandi' : 'Mijoz qo\'shildi',
        });
        onSuccess();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Xatolik',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-gray-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">
            {customer ? 'Mijozni Tahrirlash' : 'Yangi Mijoz Qo\'shish'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-400">Ism *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ism"
                        className="bg-white/5 border-white/10 text-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-400">Familiya *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Familiya"
                        className="bg-white/5 border-white/10 text-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-400">Telefon</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+998 (XX) XXX XX XX"
                      value={displayPhone}
                      onChange={handlePhoneChange}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </FormControl>
                  <p className="text-xs text-gray-500">Masalan: +998 (91) 071 28 28</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-400">Tug'ilgan Kun *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="bg-white/5 border-white/10 text-white"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-400">Izoh</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Qo'shimcha ma'lumot"
                      rows={3}
                      className="bg-white/5 border-white/10 text-white"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700"
              >
                {customer ? 'Saqlash' : 'Qo\'shish'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 bg-white/5 border-white/10 hover:bg-white/10"
                onClick={() => onOpenChange(false)}
              >
                Bekor qilish
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
