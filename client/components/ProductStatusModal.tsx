import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, Package } from "lucide-react";

export type ProductStatus = "available" | "pending" | "out-of-stock";

interface ProductStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus?: ProductStatus;
  onStatusChange: (status: ProductStatus) => void;
  productName?: string;
}

const statusConfig = {
  available: {
    label: "Yangi",
    description: "Yangi yoki deyarli ishlatilmagan mahsulot",
    icon: CheckCircle2,
    color: "text-green-500",
    badgeVariant: "default" as const,
  },
  pending: {
    label: "O'rtacha",
    description: "O'rtacha holatda, normal ishlatilgan mahsulot",
    icon: Clock,
    color: "text-yellow-500",
    badgeVariant: "secondary" as const,
  },
  "out-of-stock": {
    label: "Eski",
    description: "Eski yoki ko'proq ishlatilgan mahsulot",
    icon: XCircle,
    color: "text-orange-500",
    badgeVariant: "destructive" as const,
  },
};

export function ProductStatusModal({
  open,
  onOpenChange,
  currentStatus = "available",
  onStatusChange,
  productName,
}: ProductStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = React.useState<ProductStatus>(currentStatus);

  React.useEffect(() => {
    if (open) {
      setSelectedStatus(currentStatus);
    }
  }, [open, currentStatus]);

  const handleSave = () => {
    onStatusChange(selectedStatus);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedStatus(currentStatus);
    onOpenChange(false);
  };

  const SelectedIcon = statusConfig[selectedStatus].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] gap-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Update Product Status
          </DialogTitle>
          <DialogDescription className="text-base">
            {productName ? (
              <>
                Change the availability status for{" "}
                <span className="font-semibold text-foreground">{productName}</span>
              </>
            ) : (
              "Select the current availability status for this product"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Selector */}
          <div className="space-y-3">
            <Label htmlFor="status" className="text-base font-semibold">
              Product Status
            </Label>
            <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as ProductStatus)}>
              <SelectTrigger 
                id="status" 
                className="h-12 text-base transition-all duration-200 hover:border-primary/50 focus:border-primary"
              >
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem 
                      key={key} 
                      value={key}
                      className="cursor-pointer py-3 text-base"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${config.color}`} />
                        <span className="font-medium">{config.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Status Preview Card */}
          <div className="rounded-lg border border-border bg-card p-5 transition-all duration-300 hover:border-primary/30">
            <div className="flex items-start gap-4">
              <div className={`rounded-full bg-background p-3 ${statusConfig[selectedStatus].color}`}>
                <SelectedIcon className="h-6 w-6" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-lg">
                    {statusConfig[selectedStatus].label}
                  </h4>
                  <Badge variant={statusConfig[selectedStatus].badgeVariant} className="text-xs">
                    Selected
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {statusConfig[selectedStatus].description}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="transition-all duration-200 hover:bg-secondary"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="transition-all duration-200 hover:scale-105"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
