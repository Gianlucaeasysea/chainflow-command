import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./pages/Dashboard";
import SuppliersPage from "./pages/Suppliers";
import ItemsPage from "./pages/Items";
import BomPage from "./pages/Bom";
import PurchaseOrdersPage from "./pages/PurchaseOrders";
import ProductionOrdersPage from "./pages/ProductionOrders";
import InventoryPage from "./pages/Inventory";
import LotsPage from "./pages/Lots";
import CostsPage from "./pages/Costs";
import ReorderPage from "./pages/Reorder";
import TimelinePage from "./pages/Timeline";
import LoginPage from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppLayout session={session}>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/bom" element={<BomPage />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/production-orders" element={<ProductionOrdersPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/lots" element={<LotsPage />} />
        <Route path="/costs" element={<CostsPage />} />
        <Route path="/reorder" element={<ReorderPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
