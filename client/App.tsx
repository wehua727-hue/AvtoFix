import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import Index from "./pages/Index";
import ProductDetail from "./pages/ProductDetail";
import POS from "./pages/POS";
import PosPreview from "./pages/PosPreview";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AddStore from "./pages/AddStore";
import AddCategory from "./pages/AddCategory";
import StoreProducts from "./pages/StoreProducts";
import Stores from "./pages/Stores";
import Products from "./pages/Products";
import Stats from "./pages/Stats";
import Print from "./pages/Print";
import ProtectedRoute from "@/components/Layout/ProtectedRoute";

const queryClient = new QueryClient();
const Router = window.location.protocol === "file:" ? HashRouter : BrowserRouter;

const App = () => (
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Router>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Products />
                </ProtectedRoute>
              }
            />
            <Route
              path="/product/:id"
              element={
                <ProtectedRoute>
                  <ProductDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos"
              element={
                <ProtectedRoute>
                  <POS />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos-preview"
              element={
                <ProtectedRoute>
                  <PosPreview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-store"
              element={
                <ProtectedRoute>
                  <AddStore />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-category"
              element={
                <ProtectedRoute>
                  <AddCategory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store/:storeId"
              element={
                <ProtectedRoute>
                  <StoreProducts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stores"
              element={
                <ProtectedRoute>
                  <Stores />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <Products />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stats"
              element={
                <ProtectedRoute>
                  <Stats />
                </ProtectedRoute>
              }
            />
            <Route
              path="/print"
              element={
                <ProtectedRoute>
                  <Print />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
