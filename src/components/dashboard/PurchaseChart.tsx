import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subMonths, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";

const formatEur = (v: number) =>
  v.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function PurchaseChart() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["purchase-analytics"],
    queryFn: async () => {
      const since = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");

      const { data: pos, error: poErr } = await supabase
        .from("purchase_orders")
        .select("id, order_date")
        .gte("order_date", since);
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

      const buckets = new Map<string, { value: number; count: number }>();
      for (let i = 11; i >= 0; i--) {
        const key = format(subMonths(new Date(), i), "yyyy-MM");
        buckets.set(key, { value: 0, count: 0 });
      }

      for (const po of pos || []) {
        if (!po.order_date) continue;
        const key = po.order_date.slice(0, 7);
        const b = buckets.get(key);
        if (b) {
          b.count += 1;
          b.value += linesByPo.get(po.id) || 0;
        }
      }

      return Array.from(buckets.entries()).map(([key, v]) => {
        const d = new Date(key + "-01");
        return {
          month: format(d, "MMM yy", { locale: it }).replace(/^./, (c) => c.toUpperCase()),
          value: Math.round(v.value),
          count: v.count,
        };
      });
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
        <p className="text-sm text-destructive">Errore nel caricamento dei dati acquisti.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Andamento Acquisti (ultimi 12 mesi)</h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(213 25% 22%)" />
            <XAxis
              dataKey="month"
              tick={{ fill: "hsl(214 20% 55%)", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={{ stroke: "hsl(213 25% 22%)" }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "hsl(214 20% 55%)", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={{ stroke: "hsl(213 25% 22%)" }}
              tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "hsl(214 20% 55%)", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={{ stroke: "hsl(213 25% 22%)" }}
              allowDecimals={false}
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
              formatter={(value: number, name: string) => [
                name === "value" ? formatEur(value) : value,
                name === "value" ? "Totale" : "N° Ordini",
              ]}
            />
            <Bar yAxisId="left" dataKey="value" fill="hsl(36 90% 55%)" radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" dataKey="count" stroke="hsl(199 89% 48%)" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
