import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Package, XCircle, type LucideIcon } from 'lucide-react';
import type { ProductStatus } from '@/components/ProductStatusModal';

type StatusConfig = {
  label: string;
  description: string;
  summary: string;
  icon: LucideIcon;
  accent: string;
  badgeClass: string;
  dotClass: string;
  glowClass: string;
};

export const productStatusConfig: Record<ProductStatus, StatusConfig> = {
  available: {
    label: 'Yangi',
    description: 'Yangi yoki deyarli ishlatilmagan mahsulot.',
    summary: 'Yangi mahsulotlar yashil rangda ko‘rinadi.',
    icon: CheckCircle2,
    accent: 'text-emerald-400',
    badgeClass: 'border border-emerald-400/50 bg-emerald-500/10 text-emerald-300',
    dotClass: 'bg-emerald-400',
    glowClass: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30',
  },
  pending: {
    label: "O'rtacha",
    description: "O'rtacha holatda, normal ishlatilgan mahsulot.",
    summary: "O'rtacha holatdagi mahsulotlar sariq rangda ko'rinadi.",
    icon: Clock,
    accent: 'text-amber-400',
    badgeClass: 'border border-amber-400/50 bg-amber-500/10 text-amber-300',
    dotClass: 'bg-amber-400',
    glowClass: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30',
  },
  'out-of-stock': {
    label: 'Eski',
    description: 'Eski yoki ko‘proq ishlatilgan mahsulot.',
    summary: 'Eski mahsulotlar alohida rangda ajratib ko‘rsatiladi.',
    icon: XCircle,
    accent: 'text-orange-400',
    badgeClass: 'border border-orange-400/50 bg-orange-500/10 text-orange-300',
    dotClass: 'bg-orange-400',
    glowClass: 'bg-orange-500/10 text-orange-300 ring-1 ring-orange-500/30',
  },
  discontinued: {
    label: "O'chirilgan",
    description: "Aktiv savdodan butunlay olingan mahsulot.",
    summary: "Endi sotilmaydigan mahsulotlar qizil rangda ko'rinadi.",
    icon: Package,
    accent: 'text-red-400',
    badgeClass: 'border border-red-400/50 bg-red-500/10 text-red-300',
    dotClass: 'bg-red-400',
    glowClass: 'bg-red-500/10 text-red-300 ring-1 ring-red-500/30',
  },
};

interface ProductStatusSelectorProps {
  value: ProductStatus;
  onChange: (status: ProductStatus) => void;
  disabled?: boolean;
  className?: string;
}

const ProductStatusSelector = ({ value, onChange, disabled, className }: ProductStatusSelectorProps) => {
  const config = productStatusConfig[value];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border border-border/80 bg-card/70 p-4 shadow-lg shadow-black/5 space-y-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mahsulot statusi
          </Label>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{config.summary}</p>
        </div>
        <Badge variant="outline" className={cn('text-[11px] font-semibold', config.badgeClass)}>
          {config.label}
        </Badge>
      </div>

      <Select value={value} onValueChange={(next) => onChange(next as ProductStatus)} disabled={disabled}>
        <SelectTrigger className="h-12 rounded-xl border border-border bg-background/80 text-sm focus:ring-2 focus:ring-ring focus:border-primary/60">
          <SelectValue placeholder="Statusni tanlang" />
        </SelectTrigger>
        <SelectContent className="rounded-xl border border-border bg-popover shadow-2xl shadow-black/20">
          {Object.entries(productStatusConfig).map(([key, cfg]) => {
            const StatusIcon = cfg.icon;
            return (
              <SelectItem
                key={key}
                value={key}
                className="py-3 text-sm data-[state=checked]:bg-primary/10 data-[state=checked]:text-foreground"
              >
                <div className="flex items-center gap-3">
                  <span className={cn('h-2.5 w-2.5 rounded-full', cfg.dotClass)} />
                  <StatusIcon className={cn('h-4 w-4', cfg.accent)} />
                  <div className="flex flex-col text-left">
                    <span className="font-medium text-foreground">{cfg.label}</span>
                    <span className="text-[11px] text-muted-foreground">{cfg.description}</span>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <motion.div
        layout
        className="rounded-xl border border-border/70 bg-background/80 p-4 shadow-inner shadow-black/10"
      >
        <div className="flex items-start gap-4">
          <div className={cn('rounded-xl p-3', config.glowClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{config.label}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{config.description}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export type { ProductStatus };
export default ProductStatusSelector;

