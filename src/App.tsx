import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import SuppliersPage from "./pages/Suppliers";
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
            <Route path="/items" element={<PlaceholderPage title="Articoli" />} />
            <Route path="/bom" element={<PlaceholderPage title="Distinte Base" />} />
            <Route path="/purchase-orders" element={<PlaceholderPage title="Ordini Fornitori" />} />
            <Route path="/production-orders" element={<PlaceholderPage title="Ordini Produzione" />} />
            <Route path="/inventory" element={<PlaceholderPage title="Magazzino" />} />
            <Route path="/lots" element={<PlaceholderPage title="Lotti" />} />
            <Route path="/costs" element={<PlaceholderPage title="Costi" />} />
            <Route path="/reorder" element={<PlaceholderPage title="Riordino" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">Modulo in fase di sviluppo</p>
      </div>
    </div>
  );
}

export default App;
