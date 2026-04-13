import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const formatEur = (v: number) =>
  v.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function TopSuppliersChart() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["supplier-performance"],
    queryFn: async () => {
      const { data: pos, error: poErr } = await supabase
        .from("purchase_orders")
        .select("id, supplier_id");
      if (poErr) throw poErr;

      const poIds = (pos || []).map((p) => p.id);
      let lines: { purchase_order_id: string; quantity: number; unit_price: number }[] = [];
      if (poIds.length > 0) {
        const { data: l, error: lErr } = await supabase
          .from("po_lines")
          .select("purchase_order_id, quantity, unit_price")
          .in("purchase_order_id", poIds);
        if (lErr) throw lErr;
        lines = l || [];
      }

      const linesByPo = new Map<string, number>();
      for (const l of lines) {
        linesByPo.set(l.purchase_order_id, (linesByPo.get(l.purchase_order_id) || 0) + l.quantity * l.unit_price);
      }

      const bySupplier = new Map<string, number>();
      for (const po of pos || []) {
        bySupplier.set(po.supplier_id, (bySupplier.get(po.supplier_id) || 0) + (linesByPo.get(po.id) || 0));
      }

      const supplierIds = Array.from(bySupplier.keys());
      let suppliersMap = new Map<string, string>();
      if (supplierIds.length > 0) {
        const { data: suppliers } = await supabase
          .from("suppliers")
          .select("id, company_name")
          .in("id", supplierIds);
        for (const s of suppliers || []) {
          suppliersMap.set(s.id, s.company_name);
        }
      }

      return Array.from(bySupplier.entries())
        .map(([id, spend]) => ({
          name: suppliersMap.get(id) || "Sconosciuto",
          spend: Math.round(spend),
        }))
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 10);
    },
  });

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-5">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-[250px] w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-card border border-border rounded-lg p-5">
        <p className="text-sm text-destructive">Errore nel caricamento dei dati fornitori.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Top Fornitori per Valore Acquisti</h3>
      <div className="h-[250px]">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun dato disponibile.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <XAxis
                type="number"
                tick={{ fill: "hsl(214 20% 55%)", fontSize: 11, fontFamily: "DM Mono" }}
                axisLine={{ stroke: "hsl(213 25% 22%)" }}
                tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ fill: "hsl(214 33% 91%)", fontSize: 11 }}
                axisLine={{ stroke: "hsl(213 25% 22%)" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(213 40% 14%)",
                  border: "1px solid hsl(213 25% 22%)",
                  borderRadius: "6px",
                  color: "hsl(214 33% 91%)",
                  fontFamily: "DM Mono",
                  fontSize: 12,
                }}
                formatter={(value: number) => [formatEur(value), "Spesa"]}
              />
              <Bar dataKey="spend" fill="hsl(36 90% 55%)" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
