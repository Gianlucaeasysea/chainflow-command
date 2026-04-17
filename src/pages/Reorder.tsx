import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Settings, AlertTriangle, CheckCircle, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ExportButton from "@/components/ExportButton";
import { computeStockMap } from "@/lib/stock";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poOrderDate, setPoOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [poDeliveryDate, setPoDeliveryDate] = useState("");
  const [poLines, setPoLines] = useState<{ itemId: string; qty: number; price: number }[]>([]);
  const qc = useQueryClient();
  const navigate = useNavigate();

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

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => { const { data, error } = await supabase.from("suppliers").select("*").eq("is_active", true).order("company_name"); if (error) throw error; return data; },
  });

  const { data: supplierItems = [] } = useQuery({
    queryKey: ["supplier_items"],
    queryFn: async () => { const { data, error } = await supabase.from("supplier_items").select("*"); if (error) throw error; return data; },
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

  const createPoMut = useMutation({
    mutationFn: async () => {
      // Generate PO number
      const year = new Date().getFullYear();
      const { data: existingPos } = await supabase.from("purchase_orders").select("po_number").ilike("po_number", `PO-${year}-%`);
      const seq = (existingPos?.length || 0) + 1;
      const poNumber = `PO-${year}-${String(seq).padStart(4, "0")}`;

      const totalAmount = poLines.reduce((s, l) => s + l.qty * l.price, 0);

      const { data: poData, error: poErr } = await supabase.from("purchase_orders").insert({
        po_number: poNumber,
        supplier_id: poSupplierId,
        order_date: poOrderDate,
        requested_delivery_date: poDeliveryDate || null,
        status: "draft",
        notes: poNotes || null,
        total_amount: totalAmount,
      }).select("id").single();
      if (poErr) throw poErr;

      const lineRows = poLines.map((l, idx) => ({
        purchase_order_id: poData.id,
        item_id: l.itemId,
        quantity: l.qty,
        unit_price: l.price,
        sort_order: idx,
        line_total: l.qty * l.price,
      }));
      const { error: lineErr } = await supabase.from("po_lines").insert(lineRows);
      if (lineErr) throw lineErr;

      if (poDeliveryDate) {
        const { error: delErr } = await supabase.from("po_deliveries").insert({
          purchase_order_id: poData.id,
          scheduled_date: poDeliveryDate,
          quantity: poLines.reduce((s, l) => s + l.qty, 0),
          status: "scheduled",
        });
        if (delErr) throw delErr;
      }

      return poNumber;
    },
    onSuccess: (poNumber) => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["po_lines"] });
      setPoDialogOpen(false);
      setSelectedIds(new Set());
      toast.success(`ODA ${poNumber} creato`, {
        action: { label: "Apri ODA", onClick: () => navigate("/purchase-orders") },
      });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const stockMap = computeStockMap(movements as any);
  const getStock = (itemId: string) => stockMap.get(itemId) || 0;

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

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllCritical = () => {
    const criticalIds = suggestions.filter(i => i.status === "critical").map(i => i.id);
    setSelectedIds(new Set(criticalIds));
  };

  const openPoDialog = () => {
    const selected = suggestions.filter(i => selectedIds.has(i.id));
    // Find best supplier per item
    const supplierCounts: Record<string, number> = {};
    const lines = selected.map(item => {
      const siForItem = supplierItems.filter(si => si.item_id === item.id);
      const bestSi = siForItem.sort((a, b) => Number(a.unit_price || 999999) - Number(b.unit_price || 999999))[0];
      if (bestSi) supplierCounts[bestSi.supplier_id] = (supplierCounts[bestSi.supplier_id] || 0) + 1;

      const rop = item.rop || 0;
      const ss = item.safetyStock || 0;
      const eoq = item.eoq || 0;
      let suggestedQty = Math.max(eoq, rop + ss - item.stock);
      // Round up to order_multiple
      const mult = bestSi?.order_multiple || 1;
      if (mult > 1) suggestedQty = Math.ceil(suggestedQty / mult) * mult;

      return {
        itemId: item.id,
        qty: Math.max(suggestedQty, 1),
        price: Number(bestSi?.unit_price || 0),
      };
    });

    // Pre-select the supplier with the most items
    const bestSupplier = Object.entries(supplierCounts).sort((a, b) => b[1] - a[1])[0];
    setPoSupplierId(bestSupplier?.[0] || "");

    // Compute average lead time for delivery date
    const allSi = selected.flatMap(item => supplierItems.filter(si => si.item_id === item.id && si.lead_time_days));
    const avgLead = allSi.length > 0 ? Math.round(allSi.reduce((s, si) => s + Number(si.lead_time_days), 0) / allSi.length) : 14;
    const delivDate = new Date();
    delivDate.setDate(delivDate.getDate() + avgLead);
    setPoDeliveryDate(delivDate.toISOString().slice(0, 10));

    setPoLines(lines);
    setPoOrderDate(new Date().toISOString().slice(0, 10));
    setPoNotes("");
    setPoDialogOpen(true);
  };

  const statusIcon = (s: string) => {
    if (s === "ok") return <CheckCircle className="h-4 w-4 text-status-ok" />;
    if (s === "warning") return <AlertTriangle className="h-4 w-4 text-status-warning" />;
    if (s === "critical") return <AlertTriangle className="h-4 w-4 text-status-critical" />;
    return <Settings className="h-4 w-4 text-muted-foreground/50" />;
  };

  const getItemInfo = (id: string) => items.find(i => i.id === id);
  const poTotal = poLines.reduce((s, l) => s + l.qty * l.price, 0);

  // Check if selected items have multiple different preferred suppliers
  const hasMultipleSuppliers = (() => {
    const supplierSet = new Set<string>();
    for (const id of selectedIds) {
      const siForItem = supplierItems.filter(si => si.item_id === id);
      const best = siForItem.sort((a, b) => Number(a.unit_price || 999999) - Number(b.unit_price || 999999))[0];
      if (best) supplierSet.add(best.supplier_id);
    }
    return supplierSet.size > 1;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Logica di Riordino</h1>
          <p className="text-sm text-muted-foreground">
            {suggestions.length} articoli sotto punto di riordino
          </p>
        </div>
        <ExportButton filename="parametri_riordino" columns={[
          { key: "item_code", label: "Codice" }, { key: "description", label: "Descrizione" },
          { key: "stock", label: "Stock Attuale" }, { key: "rop", label: "ROP" },
          { key: "safetyStock", label: "Safety Stock" }, { key: "eoq", label: "EOQ" },
          { key: "maxStock", label: "Stock Max" }, { key: "mgmt", label: "Tipo Gestione" },
          { key: "status", label: "Stato" },
        ]} data={itemsWithStatus.map(i => ({
          ...i, mgmt: MGMT_TYPES.find(t => t.value === i.params?.management_type)?.label || "",
        })) as any} />
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
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                  />
                  {statusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-primary text-xs">{item.item_code}</span>
                    <span className="text-foreground/70 text-xs ml-2">{item.description}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs text-muted-foreground">Stock: <span className={cn(item.status === "critical" ? "text-status-critical" : "text-status-warning")}>{item.stock.toFixed(0)}</span> / ROP: {item.rop?.toFixed(0)}</div>
                    <div className="font-mono text-xs text-foreground">Suggerito: <span className="text-primary">{suggestedQty.toFixed(0)} {item.unit_of_measure}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Action bar */}
          <div className="p-3 border-t border-border flex items-center gap-2 bg-muted/20">
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={selectAllCritical}>
              Seleziona tutti critici
            </Button>
            <div className="flex-1" />
            {selectedIds.size > 0 && (
              <Button size="sm" className="gap-1 h-8" onClick={openPoDialog}>
                <ShoppingCart className="h-3.5 w-3.5" /> Genera PO ({selectedIds.size} selezionati)
              </Button>
            )}
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

      {/* Config Dialog */}
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

      {/* Generate PO Dialog */}
      <Dialog open={poDialogOpen} onOpenChange={setPoDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Genera Ordine d'Acquisto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Supplier */}
            <div>
              <Label>Fornitore *</Label>
              <Select value={poSupplierId} onValueChange={setPoSupplierId}>
                <SelectTrigger><SelectValue placeholder="Seleziona fornitore..." /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
              {hasMultipleSuppliers && (
                <p className="text-xs text-status-warning mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Articoli con fornitori diversi — verifica il listino
                </p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data Ordine</Label><Input type="date" className="font-mono" value={poOrderDate} onChange={e => setPoOrderDate(e.target.value)} /></div>
              <div><Label>Data Consegna Attesa</Label><Input type="date" className="font-mono" value={poDeliveryDate} onChange={e => setPoDeliveryDate(e.target.value)} /></div>
            </div>

            {/* Lines table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Articolo", "Qtà suggerita", "Prezzo unit.", "Totale"].map(h => (
                      <th key={h} className="text-left p-2 text-muted-foreground text-xs uppercase font-mono">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {poLines.map((line, idx) => {
                    const item = getItemInfo(line.itemId);
                    return (
                      <tr key={line.itemId} className="hover:bg-muted/20">
                        <td className="p-2">
                          <span className="font-mono text-primary text-xs">{item?.item_code || "?"}</span>
                          <span className="text-xs text-muted-foreground ml-1">{item?.description || ""}</span>
                        </td>
                        <td className="p-2">
                          <Input type="number" min="1" className="w-20 h-7 text-xs font-mono" value={line.qty}
                            onChange={e => {
                              const next = [...poLines];
                              next[idx] = { ...next[idx], qty: Number(e.target.value) || 1 };
                              setPoLines(next);
                            }} />
                        </td>
                        <td className="p-2">
                          <Input type="number" step="0.01" className="w-24 h-7 text-xs font-mono" value={line.price}
                            onChange={e => {
                              const next = [...poLines];
                              next[idx] = { ...next[idx], price: Number(e.target.value) || 0 };
                              setPoLines(next);
                            }} />
                        </td>
                        <td className="p-2 font-mono text-xs text-foreground">€{(line.qty * line.price).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/20">
                    <td colSpan={3} className="p-2 text-right text-xs font-semibold text-muted-foreground">Totale</td>
                    <td className="p-2 font-mono text-sm font-bold text-primary">€{poTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Notes */}
            <div><Label>Note</Label><Textarea value={poNotes} onChange={e => setPoNotes(e.target.value)} rows={2} /></div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPoDialogOpen(false)}>Annulla</Button>
              <Button onClick={() => createPoMut.mutate()} disabled={!poSupplierId || createPoMut.isPending}>
                Crea Ordine d'Acquisto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
