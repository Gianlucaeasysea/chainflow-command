import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Settings, AlertTriangle, CheckCircle, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MGMT_TYPES = [
  { value: "reorder_point", label: "Punto di Riordino" },
  { value: "mrp", label: "MRP" },
  { value: "jit", label: "Just in Time" },
  { value: "make_to_order", label: "Make to Order" },
];

export default function ReorderPage() {
  const [configOpen, setConfigOpen] = useState(false);
  const [configItem, setConfigItem] = useState<any>(null);
  const [form, setForm] = useState({
    reorder_point: "0", safety_stock: "0", eoq: "0", max_stock: "0",
    management_type: "reorder_point", service_level: "95",
  });
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => { const { data, error } = await supabase.from("items").select("*").order("item_code"); if (error) throw error; return data; },
  });

  const { data: reorderParams = [] } = useQuery({
    queryKey: ["reorder_params"],
    queryFn: async () => { const { data, error } = await supabase.from("reorder_params").select("*"); if (error) throw error; return data; },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["stock_movements"],
    queryFn: async () => { const { data, error } = await supabase.from("stock_movements").select("*"); if (error) throw error; return data; },
  });

  const upsertMut = useMutation({
    mutationFn: async () => {
      const existing = reorderParams.find(r => r.item_id === configItem.id);
      const payload = {
        item_id: configItem.id,
        reorder_point: parseFloat(form.reorder_point),
        safety_stock: parseFloat(form.safety_stock),
        eoq: parseFloat(form.eoq),
        max_stock: parseFloat(form.max_stock),
        management_type: form.management_type,
        service_level: parseFloat(form.service_level),
      };
      if (existing) {
        const { error } = await supabase.from("reorder_params").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reorder_params").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reorder_params"] });
      setConfigOpen(false);
      toast.success("Parametri salvati");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Compute current stock from movements
  const getStock = (itemId: string) => {
    return movements
      .filter(m => m.item_id === itemId)
      .reduce((sum, m) => sum + Number(m.quantity), 0);
  };

  const itemsWithStatus = items.map(item => {
    const params = reorderParams.find(r => r.item_id === item.id);
    const stock = getStock(item.id);
    const rop = params ? Number(params.reorder_point) : null;
    const safetyStock = params ? Number(params.safety_stock) : null;
    let status: "ok" | "warning" | "critical" | "unconfigured" = "unconfigured";
    if (rop !== null) {
      if (stock <= 0) status = "critical";
      else if (stock <= (safetyStock || 0)) status = "critical";
      else if (stock <= rop) status = "warning";
      else status = "ok";
    }
    return { ...item, stock, params, status, rop, safetyStock, eoq: params ? Number(params.eoq) : null, maxStock: params ? Number(params.max_stock) : null };
  });

  const suggestions = itemsWithStatus.filter(i => i.status === "warning" || i.status === "critical");

  const openConfig = (item: any) => {
    setConfigItem(item);
    const params = reorderParams.find(r => r.item_id === item.id);
    setForm({
      reorder_point: params ? String(params.reorder_point) : "0",
      safety_stock: params ? String(params.safety_stock) : "0",
      eoq: params ? String(params.eoq) : "0",
      max_stock: params ? String(params.max_stock) : "0",
      management_type: params?.management_type || "reorder_point",
      service_level: params ? String(params.service_level) : "95",
    });
    setConfigOpen(true);
  };

  const statusIcon = (s: string) => {
    if (s === "ok") return <CheckCircle className="h-4 w-4 text-status-ok" />;
    if (s === "warning") return <AlertTriangle className="h-4 w-4 text-status-warning" />;
    if (s === "critical") return <AlertTriangle className="h-4 w-4 text-status-critical" />;
    return <Settings className="h-4 w-4 text-muted-foreground/50" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Logica di Riordino</h1>
          <p className="text-sm text-muted-foreground">
            {suggestions.length} articoli sotto punto di riordino
          </p>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-card border border-status-warning/30 rounded-lg">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-status-warning" />
            <span className="text-sm font-semibold text-foreground">Suggerimenti di Riordino</span>
            <Badge className="status-warning text-xs ml-auto">{suggestions.length}</Badge>
          </div>
          <div className="divide-y divide-border">
            {suggestions.map(item => {
              const suggestedQty = item.eoq || (item.maxStock ? item.maxStock - item.stock : 0);
              return (
                <div key={item.id} className="p-3 flex items-center gap-4">
                  {statusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-primary text-xs">{item.item_code}</span>
                    <span className="text-foreground/70 text-xs ml-2">{item.description}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs text-muted-foreground">Stock: <span className={cn(item.status === "critical" ? "text-status-critical" : "text-status-warning")}>{item.stock.toFixed(0)}</span> / ROP: {item.rop?.toFixed(0)}</div>
                    <div className="font-mono text-xs text-foreground">Suggerito: <span className="text-primary">{suggestedQty.toFixed(0)} {item.unit_of_measure}</span></div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0">
                    <ShoppingCart className="h-3 w-3" /> Crea PO
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Items Grid */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["", "Codice", "Descrizione", "Stock", "ROP", "Safety Stock", "EOQ", "Max", "Tipo Gestione", ""].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {itemsWithStatus.map(item => (
                <tr key={item.id} className="hover:bg-muted/20">
                  <td className="p-3 w-8">{statusIcon(item.status)}</td>
                  <td className="p-3 font-mono text-primary text-xs">{item.item_code}</td>
                  <td className="p-3 text-foreground text-xs">{item.description}</td>
                  <td className="p-3 font-mono">{item.stock.toFixed(0)}</td>
                  <td className="p-3 font-mono text-muted-foreground">{item.rop?.toFixed(0) || "—"}</td>
                  <td className="p-3 font-mono text-muted-foreground">{item.safetyStock?.toFixed(0) || "—"}</td>
                  <td className="p-3 font-mono text-muted-foreground">{item.eoq?.toFixed(0) || "—"}</td>
                  <td className="p-3 font-mono text-muted-foreground">{item.maxStock?.toFixed(0) || "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{MGMT_TYPES.find(t => t.value === item.params?.management_type)?.label || "—"}</td>
                  <td className="p-3">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openConfig(item)}>
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Parametri Riordino — {configItem?.item_code}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsertMut.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Punto di Riordino (ROP)</Label><Input type="number" step="1" className="font-mono" value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: e.target.value })} /></div>
              <div><Label>Safety Stock</Label><Input type="number" step="1" className="font-mono" value={form.safety_stock} onChange={(e) => setForm({ ...form, safety_stock: e.target.value })} /></div>
              <div><Label>EOQ</Label><Input type="number" step="1" className="font-mono" value={form.eoq} onChange={(e) => setForm({ ...form, eoq: e.target.value })} /></div>
              <div><Label>Max Stock</Label><Input type="number" step="1" className="font-mono" value={form.max_stock} onChange={(e) => setForm({ ...form, max_stock: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo Gestione</Label>
                <Select value={form.management_type} onValueChange={(v) => setForm({ ...form, management_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MGMT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Livello Servizio %</Label><Input type="number" step="0.5" min="90" max="99.9" className="font-mono" value={form.service_level} onChange={(e) => setForm({ ...form, service_level: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfigOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={upsertMut.isPending}>Salva</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
