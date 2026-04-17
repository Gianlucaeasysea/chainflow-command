import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays } from "date-fns";

type Alert = { title: string; desc: string; severity: "critical" | "warning"; link: string };

const refetchInterval = 300000;

export function AlertPanel() {
  const navigate = useNavigate();

  const latePo = useQuery({
    queryKey: ["alert-late-po"],
    refetchInterval,
    queryFn: async () => {
      const { data: pos, error: e1 } = await supabase
        .from("purchase_orders")
        .select("id, po_number, supplier_id")
        .not("status", "in", '("delivered","closed","cancelled")');
      if (e1) throw e1;
      if (!pos?.length) return [] as Alert[];

      const poIds = pos.map((p) => p.id);
      const { data: dels } = await supabase
        .from("po_deliveries")
        .select("purchase_order_id, scheduled_date, actual_delivery_date")
        .in("purchase_order_id", poIds)
        .is("actual_delivery_date", null)
        .lt("scheduled_date", new Date().toISOString().slice(0, 10));
      if (!dels?.length) return [] as Alert[];

      const supplierIds = [...new Set(pos.map((p) => p.supplier_id))];
      const { data: suppliers } = await supabase.from("suppliers").select("id, company_name").in("id", supplierIds);
      const sMap = new Map((suppliers || []).map((s) => [s.id, s.company_name]));

      const latePosMap = new Map<string, string>();
      for (const d of dels) {
        const existing = latePosMap.get(d.purchase_order_id);
        if (!existing || d.scheduled_date < existing) latePosMap.set(d.purchase_order_id, d.scheduled_date);
      }

      return Array.from(latePosMap.entries())
        .map(([poId, date]) => {
          const po = pos.find((p) => p.id === poId)!;
          const days = differenceInDays(new Date(), new Date(date));
          return {
            title: `${po.po_number} — ${sMap.get(po.supplier_id) || "?"}`,
            desc: `In ritardo di ${days} giorni`,
            severity: "critical" as const,
            link: "/purchase-orders",
          };
        })
        .sort((a, b) => parseInt(b.desc) - parseInt(a.desc))
        .slice(0, 5);
    },
  });

  const belowRop = useQuery({
    queryKey: ["alert-below-rop"],
    refetchInterval,
    queryFn: async () => {
      const { data: params } = await supabase.from("reorder_params").select("item_id, reorder_point");
      if (!params?.length) return [] as Alert[];

      const itemIds = params.map((p) => p.item_id);
      const { data: movements } = await supabase.from("stock_movements").select("item_id, movement_type, quantity").in("item_id", itemIds);
      const { data: items } = await supabase.from("items").select("id, item_code, description, unit_of_measure").in("id", itemIds);

      const stockMap = computeStockMap(movements || []);
      const iMap = new Map((items || []).map((i) => [i.id, i]));

      return params
        .filter((p) => p.reorder_point != null && (stockMap.get(p.item_id) || 0) <= p.reorder_point)
        .map((p) => {
          const stock = stockMap.get(p.item_id) || 0;
          const item = iMap.get(p.item_id);
          return {
            title: `${item?.item_code || "?"} — ${item?.description || "?"}`,
            desc: `Stock: ${stock} ${item?.unit_of_measure || ""} (ROP: ${p.reorder_point})`,
            severity: (stock <= 0 ? "critical" : "warning") as "critical" | "warning",
            link: "/reorder",
            _stock: stock,
          };
        })
        .sort((a, b) => a._stock - b._stock)
        .slice(0, 5)
        .map(({ _stock, ...rest }) => rest);
    },
  });

  const expiringLots = useQuery({
    queryKey: ["alert-expiring-lots"],
    refetchInterval,
    queryFn: async () => {
      const now = new Date().toISOString().slice(0, 10);
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const { data: lots } = await supabase
        .from("inventory_lots")
        .select("lot_number, item_id, expiry_date")
        .eq("status", "approved")
        .not("expiry_date", "is", null)
        .gte("expiry_date", now)
        .lte("expiry_date", in30)
        .order("expiry_date", { ascending: true })
        .limit(5);
      if (!lots?.length) return [] as Alert[];

      const itemIds = [...new Set(lots.map((l) => l.item_id))];
      const { data: items } = await supabase.from("items").select("id, description").in("id", itemIds);
      const iMap = new Map((items || []).map((i) => [i.id, i.description]));

      return lots.map((l) => {
        const days = differenceInDays(new Date(l.expiry_date!), new Date());
        return {
          title: `Lotto ${l.lot_number} — ${iMap.get(l.item_id) || "?"}`,
          desc: `Scade il ${format(new Date(l.expiry_date!), "dd/MM/yyyy")} (${days} giorni)`,
          severity: (days < 7 ? "critical" : "warning") as "critical" | "warning",
          link: "/lots",
        };
      });
    },
  });

  const expiringCerts = useQuery({
    queryKey: ["alert-expiring-certs"],
    refetchInterval,
    queryFn: async () => {
      const now = new Date().toISOString().slice(0, 10);
      const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      const { data: certs } = await supabase
        .from("supplier_certifications")
        .select("certification_name, expiry_date, supplier_id")
        .not("expiry_date", "is", null)
        .gte("expiry_date", now)
        .lte("expiry_date", in60)
        .order("expiry_date", { ascending: true })
        .limit(5);
      if (!certs?.length) return [] as Alert[];

      const sIds = [...new Set(certs.map((c) => c.supplier_id))];
      const { data: suppliers } = await supabase.from("suppliers").select("id, company_name").in("id", sIds);
      const sMap = new Map((suppliers || []).map((s) => [s.id, s.company_name]));

      return certs.map((c) => {
        const days = differenceInDays(new Date(c.expiry_date!), new Date());
        return {
          title: `Cert. ${c.certification_name} — ${sMap.get(c.supplier_id) || "?"}`,
          desc: `Scade il ${format(new Date(c.expiry_date!), "dd/MM/yyyy")} (${days} giorni)`,
          severity: "warning" as const,
          link: "/suppliers",
        };
      });
    },
  });

  const isLoading = latePo.isLoading || belowRop.isLoading || expiringLots.isLoading || expiringCerts.isLoading;

  const allAlerts: Alert[] = [
    ...(latePo.data || []),
    ...(belowRop.data || []),
    ...(expiringLots.data || []),
    ...(expiringCerts.data || []),
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-status-warning" />
          Alert Attivi
        </h3>
        {!isLoading && <Badge variant={allAlerts.length > 0 ? "destructive" : "secondary"}>{allAlerts.length}</Badge>}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : allAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <CheckCircle className="h-8 w-8 text-status-ok" />
          <p className="text-sm text-muted-foreground">Nessun alert attivo — tutto in ordine</p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-[500px]">
          {allAlerts.map((a, i) => (
            <button
              key={i}
              onClick={() => navigate(a.link)}
              className="w-full text-left flex items-start gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors group"
            >
              <AlertTriangle
                className={`h-4 w-4 mt-0.5 shrink-0 ${a.severity === "critical" ? "text-status-critical" : "text-status-warning"}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
