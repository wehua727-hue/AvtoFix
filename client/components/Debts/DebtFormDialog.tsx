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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { addDebt, updateDebt } from '@/services/debtService';
import type { IDebt } from '@shared/debt-types';
import { User, DollarSign, Phone, Calendar, FileText, X, Plus } from 'lucide-react';

const debtSchema = z.object({
  creditor: z.string().min(1, 'Qarzdor ismini kiriting'),
  amount: z.coerce.number().min(1, 'Summani kiriting'),
  currency: z.string().default('USD'),
  phone: z.string().optional(),
  description: z.string().optional(),
  debtDate: z.string().min(1, 'Sanani tanlang'),
  dueDate: z.string().optional(), // To'lov muddati
});

type DebtFormValues = z.infer<typeof debtSchema>;

interface DebtFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt?: IDebt | null;
  onSuccess: () => void;
}

export default function DebtFormDialog({
  open,
  onOpenChange,
  debt,
  onSuccess,
}: DebtFormDialogProps) {
  const { toast } = useToast();
  const [amountDisplay, setAmountDisplay] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // Takroriy yuborishni oldini olish
  
  const form = useForm({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      creditor: '',
      amount: 0,
      currency: 'USD',
      phone: '',
      description: '',
      debtDate: new Date().toISOString().split('T')[0],
      dueDate: '',
    },
  });

  // Summani formatlash funksiyasi
  const formatAmount = (value: string) => {
    // Faqat raqamlarni qoldirish
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    
    // Raqamlarni 3 ta bo'lib ajratish
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const handleAmountChange = (value: string) => {
    const formatted = formatAmount(value);
    setAmountDisplay(formatted);
    
    // Faqat raqamlarni formga saqlash
    const numbers = value.replace(/\D/g, '');
    form.setValue('amount', numbers ? parseInt(numbers) : 0);
  };

  useEffect(() => {
    // Dialog ochilganda/yopilganda isSubmitting ni reset qilish
    if (!open) {
      setIsSubmitting(false);
    }
    
    if (debt) {
      form.reset({
        creditor: debt.creditor,
        amount: debt.amount,
        currency: debt.currency,
        phone: debt.phone || '',
        description: debt.description || '',
        debtDate: debt.debtDate.split('T')[0],
        dueDate: debt.dueDate ? debt.dueDate.split('T')[0] : '',
      });
      setAmountDisplay(formatAmount(debt.amount.toString()));
    } else {
      form.reset({
        creditor: '',
        amount: 0,
        currency: 'USD',
        phone: '',
        description: '',
        debtDate: new Date().toISOString().split('T')[0],
        dueDate: '',
      });
      setAmountDisplay('');
    }
  }, [debt, form, open]);

  const onSubmit = async (values: any) => {
    // Agar allaqachon yuborilayotgan bo'lsa, qaytish (takroriy yuborishni oldini olish)
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const debtData = {
        ...values,
        countryCode: '+998',
      };

      const result = debt
        ? await updateDebt(debt._id, debtData)
        : await addDebt(debtData);

      if (result.success) {
        toast({
          title: 'Muvaffaqiyatli',
          description: debt ? 'Qarz yangilandi' : 'Qarz qo\'shildi',
        });
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: 'Xatolik',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700/50 shadow-2xl p-0 max-h-[95vh] overflow-y-auto">
        {/* Header - Qizil-kulrang gradient */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 px-6 py-4 relative overflow-hidden sticky top-0 z-10">
          <div className="absolute inset-0 bg-black/10"></div>
          <DialogTitle className="text-white text-lg font-semibold relative z-10">
            {debt ? 'Qarzni tahrirlash' : 'Qarz ma\'lumotlarini to\'ldiring'}
          </DialogTitle>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 pb-6 pt-4 space-y-3">
            {/* Kreditor */}
            <FormField
              control={form.control}
              name="creditor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-red-400 flex items-center gap-1.5 text-sm font-medium">
                    <User className="w-3.5 h-3.5" />
                    Kreditor *
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Masalan: Ali"
                      className="bg-slate-800/70 border-slate-700 text-white placeholder:text-slate-500 h-10 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Summa */}
            <FormField
              control={form.control}
              name="amount"
              render={() => (
                <FormItem>
                  <FormLabel className="text-red-400 flex items-center gap-1.5 text-sm font-medium">
                    <DollarSign className="w-3.5 h-3.5" />
                    Summa *
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type="text"
                          placeholder="234 567 976 544 567 898 765"
                          value={amountDisplay}
                          onChange={(e) => handleAmountChange(e.target.value)}
                          className="bg-slate-800/70 border-slate-700 text-white placeholder:text-slate-500 h-10 pr-16 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
                          {form.watch('currency')}
                        </div>
                      </div>
                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="w-24 bg-slate-800/70 border-slate-700 text-white h-10 focus:border-red-500 focus:ring-1 focus:ring-red-500/50">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700">
                                  <SelectItem value="UZS" className="text-white hover:bg-red-600 focus:bg-red-600">UZS - O'zbek so'mi</SelectItem>
                                  <SelectItem value="USD" className="text-white hover:bg-red-600 focus:bg-red-600">USD - Dollar</SelectItem>
                                  <SelectItem value="RUB" className="text-white hover:bg-red-600 focus:bg-red-600">RUB - Rubl</SelectItem>
                                  <SelectItem value="CNY" className="text-white hover:bg-red-600 focus:bg-red-600">CNY - Yuan</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Telefon */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-red-400 flex items-center gap-1.5 text-sm font-medium">
                    <Phone className="w-3.5 h-3.5" />
                    Telefon <span className="text-slate-500 text-xs">(ixtiyoriy)</span>
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <div className="bg-slate-800/70 border border-slate-700 rounded-md px-3 flex items-center text-white text-sm h-10">
                        UZ +998
                      </div>
                      <Input
                        placeholder="90 123 45 67"
                        maxLength={12}
                        className="flex-1 bg-slate-800/70 border-slate-700 text-white placeholder:text-slate-500 h-10 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                        value={field.value}
                        onChange={(e) => {
                          // Faqat raqamlarni qoldirish
                          const numbers = e.target.value.replace(/\D/g, '');
                          // Maksimal 9 ta raqam (90 123 45 67)
                          const limited = numbers.slice(0, 9);
                          // Formatlash: 90 123 45 67
                          let formatted = limited;
                          if (limited.length > 2) {
                            formatted = limited.slice(0, 2) + ' ' + limited.slice(2);
                          }
                          if (limited.length > 5) {
                            formatted = limited.slice(0, 2) + ' ' + limited.slice(2, 5) + ' ' + limited.slice(5);
                          }
                          if (limited.length > 7) {
                            formatted = limited.slice(0, 2) + ' ' + limited.slice(2, 5) + ' ' + limited.slice(5, 7) + ' ' + limited.slice(7);
                          }
                          field.onChange(formatted);
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Qarz sanasi va To'lov muddati */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="debtDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-red-400 flex items-center gap-1.5 text-sm font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      Qarz sanasi *
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="bg-slate-800/70 border-slate-700 text-white h-10 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-red-400 flex items-center gap-1.5 text-sm font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      To'lov muddati <span className="text-slate-500 text-xs">(ixtiyoriy)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="bg-slate-800/70 border-slate-700 text-white h-10 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tavsif */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-red-400 flex items-center gap-1.5 text-sm font-medium">
                    <FileText className="w-3.5 h-3.5" />
                    Tavsif <span className="text-slate-500 text-xs">(ixtiyoriy)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Qarz haqida qisqcha ma'lumot"
                      rows={2}
                      className="bg-slate-800/70 border-slate-700 text-white placeholder:text-slate-500 resize-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="w-full bg-slate-800/70 border-slate-700 text-white hover:bg-slate-700 h-11 text-base disabled:opacity-50"
              >
                <X className="w-4 h-4 mr-2" />
                Bekor qilish
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 hover:from-red-700 hover:via-rose-700 hover:to-pink-700 text-white h-11 font-semibold shadow-lg text-base disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saqlanmoqda...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {debt ? 'Saqlash' : 'Qarz qo\'shish'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
