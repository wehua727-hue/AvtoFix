/**
 * ProductStatusModal - Usage Examples
 * 
 * A modern, responsive modal component for managing product status.
 * Built with shadcn/ui components and Radix UI primitives.
 */

import * as React from "react";
import { ProductStatusModal, ProductStatus } from "./ProductStatusModal";
import { Button } from "@/components/ui/button";

// ============================================
// Example 1: Basic Usage
// ============================================
export function BasicExample() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [status, setStatus] = React.useState<ProductStatus>("available");

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Update Product Status
      </Button>

      <ProductStatusModal
        open={isOpen}
        onOpenChange={setIsOpen}
        currentStatus={status}
        onStatusChange={setStatus}
        productName="Wireless Headphones"
      />
    </>
  );
}

// ============================================
// Example 2: With Form Integration
// ============================================
export function FormIntegrationExample() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    price: "",
    status: "available" as ProductStatus,
  });

  const handleStatusChange = (newStatus: ProductStatus) => {
    setFormData(prev => ({ ...prev, status: newStatus }));
    console.log("Status updated:", newStatus);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    // Submit to API
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Product Name"
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        className="w-full p-2 border rounded"
      />
      
      <input
        type="number"
        placeholder="Price"
        value={formData.price}
        onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
        className="w-full p-2 border rounded"
      />

      <div className="flex items-center gap-2">
        <span>Current Status: {formData.status}</span>
        <Button type="button" onClick={() => setIsModalOpen(true)}>
          Change Status
        </Button>
      </div>

      <Button type="submit">Save Product</Button>

      <ProductStatusModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        currentStatus={formData.status}
        onStatusChange={handleStatusChange}
        productName={formData.name}
      />
    </form>
  );
}

// ============================================
// Example 3: With API Integration
// ============================================
export function ApiIntegrationExample() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [product, setProduct] = React.useState({
    id: "123",
    name: "Smart Watch",
    status: "available" as ProductStatus,
  });
  const [isLoading, setIsLoading] = React.useState(false);

  const handleStatusChange = async (newStatus: ProductStatus) => {
    setIsLoading(true);
    
    try {
      // Simulate API call
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setProduct(prev => ({ ...prev, status: newStatus }));
        console.log("Status updated successfully");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} disabled={isLoading}>
        {isLoading ? "Updating..." : "Update Status"}
      </Button>

      <ProductStatusModal
        open={isOpen}
        onOpenChange={setIsOpen}
        currentStatus={product.status}
        onStatusChange={handleStatusChange}
        productName={product.name}
      />
    </>
  );
}

// ============================================
// Example 4: Bulk Status Update
// ============================================
export function BulkUpdateExample() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedProducts, setSelectedProducts] = React.useState([
    { id: 1, name: "Product A", status: "available" as ProductStatus },
    { id: 2, name: "Product B", status: "available" as ProductStatus },
    { id: 3, name: "Product C", status: "available" as ProductStatus },
  ]);
  const [bulkStatus, setBulkStatus] = React.useState<ProductStatus>("available");

  const handleBulkStatusChange = (newStatus: ProductStatus) => {
    setSelectedProducts(prev =>
      prev.map(product => ({ ...product, status: newStatus }))
    );
    setBulkStatus(newStatus);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Update {selectedProducts.length} Products
      </Button>

      <ProductStatusModal
        open={isOpen}
        onOpenChange={setIsOpen}
        currentStatus={bulkStatus}
        onStatusChange={handleBulkStatusChange}
        productName={`${selectedProducts.length} selected products`}
      />
    </>
  );
}

// ============================================
// Example 5: With Validation
// ============================================
export function ValidationExample() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [status, setStatus] = React.useState<ProductStatus>("available");
  const [hasStock, setHasStock] = React.useState(true);

  const handleStatusChange = (newStatus: ProductStatus) => {
    // Validate before changing
    if (newStatus === "available" && !hasStock) {
      alert("Cannot set to available: Product has no stock");
      return;
    }

    if (newStatus === "discontinued") {
      const confirmed = confirm("Are you sure you want to discontinue this product?");
      if (!confirmed) return;
    }

    setStatus(newStatus);
  };

  return (
    <>
      <div className="space-y-2">
        <label>
          <input
            type="checkbox"
            checked={hasStock}
            onChange={(e) => setHasStock(e.target.checked)}
          />
          {" "}Has Stock
        </label>
        
        <Button onClick={() => setIsOpen(true)}>
          Update Status
        </Button>
      </div>

      <ProductStatusModal
        open={isOpen}
        onOpenChange={setIsOpen}
        currentStatus={status}
        onStatusChange={handleStatusChange}
        productName="Validated Product"
      />
    </>
  );
}
