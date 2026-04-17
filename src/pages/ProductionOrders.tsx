import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { POSITIVE_MOVEMENT_TYPES, WO_STATUS_LABELS } from "@/lib/constants";

const WO_STATUSES = [
  { value: "planned", label: WO_STATUS_LABELS.planned, color: "text-muted-foreground bg-muted/50" },
  { value: "materials_allocated", label: WO_STATUS_LABELS.materials_allocated, color: "status-info" },
  { value: "in_progress", label: WO_STATUS_LABELS.in_progress, color: "status-warning" },
  { value: "quality_check", label: WO_STATUS_LABELS.quality_check, color: "status-info" },
  { value: "completed", label: WO_STATUS_LABELS.completed, color: "status-ok" },
  { value: "closed", label: WO_STATUS_LABELS.closed, color: "text-muted-foreground bg-muted/30" },
];

const PRIORITIES = [
  { value: "low", label: "Bassa", color: "text-muted-foreground" },
  { value: "normal", label: "Normale", color: "text-foreground" },
  { value: "high", label: "Alta", color: "text-status-warning" },
  { value: "urgent", label: "Urgente", color: "text-status-critical" },
];

const POSITIVE_MOVE_TYPES = POSITIVE_MOVEMENT_TYPES as readonly string[];

type StockCheck = { item_code: string; description: string; needed: number; available: number; uom: string };

export default function ProductionOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    product_item_id: "", bom_header_id: "", quantity_to_produce: "1",
    priority: "normal", planned_start: "", planned_end: "", notes: "",
  });
  const [stockWarning, setStockWarning] = useState<{ orderId: string; status: string; checks: StockCheck[] } | null>(null);
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => { const { data, error } = await supabase.from("items").select("*").order("item_code"); if (error) throw error; return data; },
  });

  const { data: bomHeaders = [] } = useQuery({
    queryKey: ["bom_headers"],
    queryFn: async () => { const { data, error } = await supabase.from("bom_headers").select("*").eq("status", "active"); if (error) throw error; return data; },
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["production_orders"],
    queryFn: async () => { const { data, error } = await supabase.from("production_orders").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const woNum = `WO-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, "0")}`;
      const { error } = await supabase.from("production_orders").insert({
        wo_number: woNum,
        product_item_id: form.product_item_id,
        bom_header_id: form.bom_header_id || null,
        quantity_to_produce: parseFloat(form.quantity_to_produce),
        priority: form.priority,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production_orders"] });
      setCreateOpen(false);
      setForm({ product_item_id: "", bom_header_id: "", quantity_to_produce: "1", priority: "normal", planned_start: "", planned_end: "", notes: "" });
      toast.success("Ordine di produzione creato");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Helper: compute stock for items
  const computeStock = async (itemIds: string[]) => {
    const { data: movements } = await supabase.from("stock_movements").select("item_id, movement_type, quantity").in("item_id", itemIds);
    const map = new Map<string, number>();
    for (const m of movements || []) {
      const sign = POSITIVE_MOVE_TYPES.includes(m.movement_type) ? 1 : -1;
      map.set(m.item_id, (map.get(m.item_id) || 0) + sign * Math.abs(m.quantity));
    }
    return map;
  };

  // Perform material allocation (scarico BOM)
  const allocateMaterials = async (order: typeof orders[0]) => {
    if (!order.bom_header_id) {
      toast.error("Nessuna BOM collegata a questo WO");
      return false;
    }
    const { data: bomLines } = await supabase.from("bom_lines").select("*").eq("bom_header_id", order.bom_header_id);
    if (!bomLines?.length) {
      toast.error("BOM vuota — nessun componente da scaricare");
      return false;
    }

    const qtyToProduce = Number(order.quantity_to_produce);
    const needs = bomLines.map(bl => ({
      item_id: bl.component_item_id,
      needed: bl.quantity * qtyToProduce * (1 + (bl.waste_pct || 0) / 100),
    }));

    const stockMap = await computeStock(needs.map(n => n.item_id));

    // Check stock sufficiency
    const checks: StockCheck[] = needs.map(n => {
      const item = items.find(i => i.id === n.item_id);
      return {
        item_code: item?.item_code || "?",
        description: item?.description || "?",
        needed: Math.round(n.needed * 100) / 100,
        available: Math.round((stockMap.get(n.item_id) || 0) * 100) / 100,
        uom: item?.unit_of_measure || "",
      };
    });

    const hasDeficit = checks.some(c => c.available < c.needed);
    if (hasDeficit) {
      setStockWarning({ orderId: order.id, status: "materials_allocated", checks });
      return false; // don't proceed yet
    }

    // All ok — do the allocation
    await doAllocation(order, bomLines, qtyToProduce);
    return true;
  };

  const doAllocation = async (order: typeof orders[0], bomLines: any[], qtyToProduce: number) => {
    for (const bl of bomLines) {
      const qty = bl.quantity * qtyToProduce * (1 + (bl.waste_pct || 0) / 100);
      await supabase.from("stock_movements").insert({
        item_id: bl.component_item_id,
        movement_type: "wo_output",
        quantity: qty,
        reference_id: order.id,
        reference_type: "production_order",
        notes: `Allocato per ODP: ${order.wo_number}`,
      });
    }
    qc.invalidateQueries({ queryKey: ["stock_movements"] });
    toast.success(`Componenti scaricati per ${order.wo_number}`);
  };

  // Load finished product on completion
  const loadFinishedProduct = async (order: typeof orders[0]) => {
    const year = new Date().getFullYear();
    const { count } = await supabase.from("inventory_lots").select("id", { count: "exact", head: true }).like("lot_number", `WO-${year}-%`);
    const lotNumber = `WO-${year}-${String((count || 0) + 1).padStart(4, "0")}`;

    await supabase.from("inventory_lots").insert({
      item_id: order.product_item_id,
      lot_number: lotNumber,
      quantity_on_hand: order.quantity_to_produce,
      status: "approved",
      production_date: new Date().toISOString().split("T")[0],
    });

    await supabase.from("stock_movements").insert({
      item_id: order.product_item_id,
      movement_type: "po_inbound",
      quantity: order.quantity_to_produce,
      lot_number: lotNumber,
      reference_id: order.id,
      reference_type: "production_order",
      notes: `Prodotto da ODP: ${order.wo_number}`,
    });

    qc.invalidateQueries({ queryKey: ["inventory_lots"] });
    qc.invalidateQueries({ queryKey: ["stock_movements"] });
    toast.success(`Prodotto finito caricato a magazzino — Lotto ${lotNumber}`);
  };

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const order = orders.find(o => o.id === id);
      if (!order) throw new Error("Ordine non trovato");

      // Material allocation check
      if (status === "materials_allocated") {
        const proceeded = await allocateMaterials(order);
        if (!proceeded) return { blocked: true };
      }

      const updates: any = { status };
      if (status === "in_progress") updates.actual_start = new Date().toISOString().split("T")[0];
      if (status === "completed") updates.actual_end = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("production_orders").update(updates).eq("id", id);
      if (error) throw error;

      // Load finished product
      if (status === "completed") {
        await loadFinishedProduct(order);
      }

      return { blocked: false };
    },
    onSuccess: (data) => {
      if (data?.blocked) return;
      qc.invalidateQueries({ queryKey: ["production_orders"] });
      toast.success("Stato aggiornato");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Force allocation despite deficit
  const forceAllocateMut = useMutation({
    mutationFn: async () => {
      if (!stockWarning) return;
      const order = orders.find(o => o.id === stockWarning.orderId);
      if (!order || !order.bom_header_id) return;
      const { data: bomLines } = await supabase.from("bom_lines").select("*").eq("bom_header_id", order.bom_header_id);
      if (!bomLines) return;
      await doAllocation(order, bomLines, Number(order.quantity_to_produce));

      const updates: any = { status: "materials_allocated" };
      const { error } = await supabase.from("production_orders").update(updates).eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setStockWarning(null);
      qc.invalidateQueries({ queryKey: ["production_orders"] });
      toast.success("Materiali allocati (con deficit)");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const filtered = orders.filter(o => {
    const matchSearch = o.wo_number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getItemCode = (id: string) => items.find(i => i.id === id)?.item_code || "?";
  const getStatusInfo = (s: string) => WO_STATUSES.find(st => st.value === s) || WO_STATUSES[0];
  const getPriorityInfo = (p: string) => PRIORITIES.find(pr => pr.value === p) || PRIORITIES[1];

  const availableBoms = bomHeaders.filter(b => b.item_id === form.product_item_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Ordini di Produzione</h1>
          <p className="text-sm text-muted-foreground">{orders.length} ordini</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Nuovo WO</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca WO..." className="pl-9 font-mono text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {WO_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["N° WO", "Prodotto", "Qtà", "Priorità", "Stato", "Inizio Piano", "Fine Piano", "Azioni"].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Caricamento...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nessun ordine di produzione</td></tr>
              ) : filtered.map(o => {
                const si = getStatusInfo(o.status);
                const pi = getPriorityInfo(o.priority || "normal");
                const currentIdx = WO_STATUSES.findIndex(s => s.value === o.status);
                const nextStatus = currentIdx < WO_STATUSES.length - 1 ? WO_STATUSES[currentIdx + 1] : null;
                return (
                  <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-mono text-primary font-medium">{o.wo_number}</td>
                    <td className="p-3 font-mono text-xs">{getItemCode(o.product_item_id)}</td>
                    <td className="p-3 font-mono">{Number(o.quantity_to_produce)}</td>
                    <td className="p-3"><span className={cn("text-xs font-medium", pi.color)}>{pi.label}</span></td>
                    <td className="p-3"><Badge className={cn("text-xs", si.color)}>{si.label}</Badge></td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{o.planned_start || "—"}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{o.planned_end || "—"}</td>
                    <td className="p-3">
                      {nextStatus && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          disabled={updateStatusMut.isPending}
                          onClick={() => updateStatusMut.mutate({ id: o.id, status: nextStatus.value })}>
                          → {nextStatus.label}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create WO Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nuovo Ordine di Produzione</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
            <div>
              <Label>Prodotto *</Label>
              <Select value={form.product_item_id} onValueChange={(v) => setForm({ ...form, product_item_id: v, bom_header_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.item_code} — {i.description}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {availableBoms.length > 0 && (
              <div>
                <Label>Distinta Base</Label>
                <Select value={form.bom_header_id} onValueChange={(v) => setForm({ ...form, bom_header_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona BOM..." /></SelectTrigger>
                  <SelectContent>{availableBoms.map(b => <SelectItem key={b.id} value={b.id}>v{b.version}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantità da Produrre *</Label><Input type="number" step="1" min="1" className="font-mono" value={form.quantity_to_produce} onChange={(e) => setForm({ ...form, quantity_to_produce: e.target.value })} /></div>
              <div>
                <Label>Priorità</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Inizio Pianificato</Label><Input type="date" className="font-mono" value={form.planned_start} onChange={(e) => setForm({ ...form, planned_start: e.target.value })} /></div>
              <div><Label>Fine Pianificata</Label><Input type="date" className="font-mono" value={form.planned_end} onChange={(e) => setForm({ ...form, planned_end: e.target.value })} /></div>
            </div>
            <div><Label>Note</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={!form.product_item_id || createMut.isPending}>Crea WO</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Warning Dialog */}
      <Dialog open={!!stockWarning} onOpenChange={(open) => { if (!open) setStockWarning(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-status-warning">
              <AlertTriangle className="h-5 w-5" /> Disponibilità Insufficiente
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Alcuni componenti non hanno stock sufficiente per coprire la produzione richiesta.</p>
          <div className="bg-muted/30 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Componente", "Necessario", "Disponibile", "Delta"].map(h => (
                    <th key={h} className="text-left p-2 text-muted-foreground text-xs uppercase font-mono">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stockWarning?.checks.map((c, i) => {
                  const delta = c.available - c.needed;
                  const isDeficit = delta < 0;
                  return (
                    <tr key={i} className={isDeficit ? "bg-status-critical/10" : ""}>
                      <td className="p-2 text-xs">
                        <span className="font-mono text-primary">{c.item_code}</span>
                        <span className="text-muted-foreground ml-1">{c.description}</span>
                      </td>
                      <td className="p-2 font-mono text-xs">{c.needed} {c.uom}</td>
                      <td className="p-2 font-mono text-xs">{c.available} {c.uom}</td>
                      <td className={cn("p-2 font-mono text-xs font-medium", isDeficit ? "text-status-critical" : "text-status-ok")}>
                        {delta >= 0 ? "+" : ""}{delta.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockWarning(null)}>Annulla</Button>
            <Button variant="destructive" disabled={forceAllocateMut.isPending} onClick={() => forceAllocateMut.mutate()}>
              Procedi comunque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
