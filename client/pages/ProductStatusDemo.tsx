import * as React from "react";
import { ProductStatusModal, ProductStatus } from "@/components/ProductStatusModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Edit } from "lucide-react";

export default function ProductStatusDemo() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [currentStatus, setCurrentStatus] = React.useState<ProductStatus>("available");

  const products = [
    { id: 1, name: "Premium Wireless Headphones", status: "available" as ProductStatus },
    { id: 2, name: "Smart Watch Pro", status: "pending" as ProductStatus },
    { id: 3, name: "Laptop Stand", status: "out-of-stock" as ProductStatus },
    { id: 4, name: "Vintage Camera", status: "discontinued" as ProductStatus },
  ];

  const [productList, setProductList] = React.useState(products);
  const [selectedProduct, setSelectedProduct] = React.useState<typeof products[0] | null>(null);

  const handleEditStatus = (product: typeof products[0]) => {
    setSelectedProduct(product);
    setCurrentStatus(product.status);
    setIsModalOpen(true);
  };

  const handleStatusChange = (newStatus: ProductStatus) => {
    if (selectedProduct) {
      setProductList(prev =>
        prev.map(p =>
          p.id === selectedProduct.id ? { ...p, status: newStatus } : p
        )
      );
    }
  };

  const getStatusBadgeVariant = (status: ProductStatus) => {
    const variants = {
      available: "default",
      pending: "secondary",
      "out-of-stock": "destructive",
      discontinued: "outline",
    };
    return variants[status] as "default" | "secondary" | "destructive" | "outline";
  };

  const getStatusLabel = (status: ProductStatus) => {
    const labels = {
      available: "Available",
      pending: "Pending",
      "out-of-stock": "Out of Stock",
      discontinued: "Discontinued",
    };
    return labels[status];
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Product Status Manager
          </h1>
          <p className="text-muted-foreground text-lg">
            Manage product availability with a modern, responsive interface
          </p>
        </div>

        {/* Product Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {productList.map((product) => (
            <Card
              key={product.id}
              className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/50"
            >
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <Badge variant={getStatusBadgeVariant(product.status)} className="text-xs">
                    {getStatusLabel(product.status)}
                  </Badge>
                </div>
                <CardTitle className="text-lg leading-tight">
                  {product.name}
                </CardTitle>
                <CardDescription className="text-sm">
                  Product ID: #{product.id}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => handleEditStatus(product)}
                  variant="outline"
                  className="w-full transition-all duration-200 hover:bg-primary hover:text-primary-foreground group-hover:border-primary"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Update Status
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Demo Section */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Try It Out</CardTitle>
            <CardDescription>
              Click the button below to open the status modal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => {
                setSelectedProduct({ id: 0, name: "Sample Product", status: currentStatus });
                setIsModalOpen(true);
              }}
              size="lg"
              className="w-full sm:w-auto transition-all duration-200 hover:scale-105"
            >
              <Package className="mr-2 h-5 w-5" />
              Open Status Modal
            </Button>
          </CardContent>
        </Card>

        {/* Features List */}
        <Card>
          <CardHeader>
            <CardTitle>Component Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                "Fully responsive design (mobile to desktop)",
                "Smooth animations and transitions",
                "Accessible keyboard navigation",
                "Visual status indicators with icons",
                "Real-time preview of selected status",
                "Clean, modern dark theme",
                "Touch-friendly on mobile devices",
                "Consistent with shadcn/ui design system",
              ].map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Status Modal */}
      <ProductStatusModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        currentStatus={currentStatus}
        onStatusChange={handleStatusChange}
        productName={selectedProduct?.name}
      />
    </div>
  );
}
