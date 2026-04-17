import { Warehouse, FileText, Factory, Package, AlertTriangle, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { PurchaseChart } from "@/components/dashboard/PurchaseChart";
import { TopSuppliersChart } from "@/components/dashboard/TopSuppliersChart";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTIVE_WO_STATUSES } from "@/lib/constants";
import { computeStockMap } from "@/lib/stock";

const formatEur = (v: number) =>
  v.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const refetchInterval = 60000;

function KpiSkeleton() {
  return <Skeleton className="h-6 w-20" />;
}

export default function Dashboard() {
  const stockValue = useQuery({
    queryKey: ["kpi-stock-value"],
    refetchInterval,
    queryFn: async () => {
      const { data: lots, error: e1 } = await supabase
        .from("inventory_lots")
        .select("item_id, quantity_on_hand, status")
        .not("status", "in", '("exhausted","rejected")');
      if (e1) throw e1;

      const itemIds = [...new Set((lots || []).map((l) => l.item_id))];
      if (itemIds.length === 0) return 0;

      const { data: items, error: e2 } = await supabase
        .from("items")
        .select("id, unit_cost")
        .in("id", itemIds);
      if (e2) throw e2;

      const costMap = new Map((items || []).map((i) => [i.id, i.unit_cost || 0]));
      return (lots || []).reduce(
        (sum, l) => sum + l.quantity_on_hand * (costMap.get(l.item_id) || 0),
        0
      );
    },
  });

  const openPo = useQuery({
    queryKey: ["kpi-open-po"],
    refetchInterval,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "sent", "confirmed", "pre_series", "in_production", "shipping", "customs"]);
      if (error) throw error;
      return count || 0;
    },
  });

  const activeWo = useQuery({
    queryKey: ["kpi-active-wo"],
    refetchInterval,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("production_orders")
        .select("id", { count: "exact", head: true })
        .in("status", ACTIVE_WO_STATUSES as unknown as string[]);
      if (error) throw error;
      return count || 0;
    },
  });

  const belowRop = useQuery({
    queryKey: ["kpi-below-rop"],
    refetchInterval,
    queryFn: async () => {
      const { data: params, error: e1 } = await supabase
        .from("reorder_params")
        .select("item_id, reorder_point");
      if (e1) throw e1;
      if (!params || params.length === 0) return 0;

      const itemIds = params.map((p) => p.item_id);
      const { data: movements, error: e2 } = await supabase
        .from("stock_movements")
        .select("item_id, movement_type, quantity")
        .in("item_id", itemIds);
      if (e2) throw e2;

      const stockMap = computeStockMap(movements || []);

      return params.filter((p) => {
        const stock = stockMap.get(p.item_id) || 0;
        return p.reorder_point != null && stock < p.reorder_point;
      }).length;
    },
  });

  const expiringLots = useQuery({
    queryKey: ["kpi-expiring-lots"],
    refetchInterval,
    queryFn: async () => {
      const now = new Date().toISOString().slice(0, 10);
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const { count, error } = await supabase
        .from("inventory_lots")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .not("expiry_date", "is", null)
        .gte("expiry_date", now)
        .lte("expiry_date", in30);
      if (error) throw error;
      return count || 0;
    },
  });

  const lowRating = useQuery({
    queryKey: ["kpi-low-rating"],
    refetchInterval,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("suppliers")
        .select("id", { count: "exact", head: true })
        .not("rating", "is", null)
        .lt("rating", 3);
      if (error) throw error;
      return count || 0;
    },
  });

  const kpiVal = (q: typeof stockValue, formatter?: (v: number) => string) => {
    if (q.isLoading) return <KpiSkeleton />;
    if (q.isError || q.data == null) return "--";
    return formatter ? formatter(q.data) : String(q.data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Panoramica supply chain in tempo reale</p>
        </div>
        <QuickActions />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Valore Stock" value={kpiVal(stockValue, formatEur)} icon={Warehouse} subtitle="calcolato da lotti attivi" />
        <KpiCard title="PO Aperti" value={kpiVal(openPo)} icon={FileText} subtitle="ordini in corso" />
        <KpiCard title="WO Attivi" value={kpiVal(activeWo)} icon={Factory} subtitle="ordini produzione" />
        <KpiCard title="Sotto ROP" value={kpiVal(belowRop)} icon={Package} variant="warning" subtitle="articoli da riordinare" />
        <KpiCard title="Lotti Scadenza" value={kpiVal(expiringLots)} icon={AlertTriangle} variant="critical" subtitle="entro 30 giorni" />
        <KpiCard title="Fornitori < 3★" value={kpiVal(lowRating)} icon={Users} variant="warning" subtitle="da valutare" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <PurchaseChart />
          <TopSuppliersChart />
        </div>
        <AlertPanel />
      </div>
    </div>
  );
}
