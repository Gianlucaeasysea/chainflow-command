import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
