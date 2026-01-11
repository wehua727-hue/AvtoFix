import "./global.css";

import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationStack } from "@/components/ui/notification-stack";
import { useNotifications } from "@/hooks/use-notifications";
import { WebSocketProvider } from "@/components/WebSocketProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";

// Lazy load WebGL Loader for better performance
const WebGLLoader = lazy(() => import("@/components/ui/WebGLLoader"));

import ProductDetail from "./pages/ProductDetail";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AddStore from "./pages/AddStore";
import AddCategory from "./pages/AddCategory";
import StoreProducts from "./pages/StoreProducts";
import Stores from "./pages/Stores";
import Products from "./pages/Products";
import Stats from "./pages/Stats";
import Print from "./pages/Print";
import Users from "./pages/Users";
import Xodimlar from "./pages/Xodimlar";
import Debts from "./pages/Debts";
import Customers from "./pages/Customers";
import OfflineProducts from "./pages/OfflineProducts";
import TelegramSetup from "./pages/TelegramSetup";
import Kassa from "./pages/Kassa";
import AccountBlocked from "./pages/AccountBlocked";
import ProtectedRoute from "@/components/Layout/ProtectedRoute";

const queryClient = new QueryClient();
const Router = window.location.protocol === "file:" ? HashRouter : BrowserRouter;

const AppContent = () => {
  const { notifications, remove } = useNotifications();

  return (
    <>
      <Toaster />
      <Sonner />
      <NotificationStack notifications={notifications} onRemove={remove} />
    </>
  );
};

// Auth loading wrapper - shows 3D loader while checking auth
const AuthLoadingWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <Suspense fallback={<div className="fixed inset-0 bg-gray-950" />}>
        <WebGLLoader text="Yuklanmoqda..." subText="Tizimga kirilmoqda" />
      </Suspense>
    );
  }

  return <>{children}</>;
};

// Main app with auth wrapper inside AuthProvider
const AppWithAuth = () => {
  return (
    <AuthLoadingWrapper>
      <WebSocketProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AppContent />
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/account-blocked" element={<AccountBlocked />} />
                <Route path="/telegram-setup" element={<TelegramSetup />} />
                <Route path="/" element={<ProtectedRoute><Kassa /></ProtectedRoute>} />
                <Route path="/product/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
                <Route path="/add-store" element={<ProtectedRoute><AddStore /></ProtectedRoute>} />
                <Route path="/add-category" element={<ProtectedRoute><AddCategory /></ProtectedRoute>} />
                <Route path="/store/:storeId" element={<ProtectedRoute><StoreProducts /></ProtectedRoute>} />
                <Route path="/stores" element={<ProtectedRoute><Stores /></ProtectedRoute>} />
                <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
                <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
                <Route path="/print" element={<ProtectedRoute><Print /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
                <Route path="/xodimlar" element={<ProtectedRoute><Xodimlar /></ProtectedRoute>} />
                <Route path="/debts" element={<ProtectedRoute><Debts /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                <Route path="/offline-products" element={<ProtectedRoute><OfflineProducts /></ProtectedRoute>} />
                <Route path="/kassa" element={<ProtectedRoute><Kassa /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Router>
          </TooltipProvider>
        </QueryClientProvider>
      </WebSocketProvider>
    </AuthLoadingWrapper>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppWithAuth />
      </AuthProvider>
    </ThemeProvider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
