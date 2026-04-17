import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, AlertTriangle, Zap, Eye, History } from "lucide-react";
import TableSkeleton from "@/components/TableSkeleton";
import EmptyState from "@/components/EmptyState";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WO_STATUS_LABELS } from "@/lib/constants";
import { computeStockMap } from "@/lib/stock";

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
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: woHistory = [] } = useQuery({
    queryKey: ["wo_status_history", detailOrderId],
    queryFn: async () => {
      if (!detailOrderId) return [];
      const { data, error } = await supabase
        .from("wo_status_history")
        .select("*")
        .eq("production_order_id", detailOrderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!detailOrderId,
  });

  

  const { data: detailBomLines = [] } = useQuery({
    queryKey: ["bom_lines_detail", detailOrderId],
    queryFn: async () => {
      if (!detailOrderId) return [];
      const order = (await supabase.from("production_orders").select("bom_header_id").eq("id", detailOrderId).maybeSingle()).data;
      if (!order?.bom_header_id) return [];
      const { data, error } = await supabase
        .from("bom_lines")
        .select("*")
        .eq("bom_header_id", order.bom_header_id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!detailOrderId,
  });

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
      const { data, error } = await supabase.from("production_orders").insert({
        wo_number: woNum,
        product_item_id: form.product_item_id,
        bom_header_id: form.bom_header_id || null,
        quantity_to_produce: parseFloat(form.quantity_to_produce),
        priority: form.priority,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
        notes: form.notes || null,
      }).select("id").single();
      if (error) throw error;
      // Audit trail: initial status
      await supabase.from("wo_status_history").insert({
        production_order_id: data.id,
        status: "planned",
        notes: "ODP creato",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production_orders"] });
      qc.invalidateQueries({ queryKey: ["wo_status_history"] });
      setCreateOpen(false);
      setForm({ product_item_id: "", bom_header_id: "", quantity_to_produce: "1", priority: "normal", planned_start: "", planned_end: "", notes: "" });
      toast.success("Ordine di produzione creato");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Helper: compute stock for items
  const computeStock = async (itemIds: string[]) => {
    const { data: movements } = await supabase.from("stock_movements").select("item_id, movement_type, quantity").in("item_id", itemIds);
    return computeStockMap(movements || []);
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
        quantity: Math.abs(qty),
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
      notes: `Prodotto da ODP: ${order.wo_number}`,
    });

    await supabase.from("stock_movements").insert({
      item_id: order.product_item_id,
      movement_type: "wo_finish",
      quantity: Math.abs(order.quantity_to_produce),
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
      const oldStatus = order.status || "unknown";

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

      // Audit trail
      const oldLabel = WO_STATUSES.find(s => s.value === oldStatus)?.label || oldStatus;
      const newLabel = WO_STATUSES.find(s => s.value === status)?.label || status;
      await supabase.from("wo_status_history").insert({
        production_order_id: id,
        status,
        notes: `Da ${oldLabel} → ${newLabel}`,
      });

      // Load finished product
      if (status === "completed") {
        await loadFinishedProduct(order);
      }

      return { blocked: false };
    },
    onSuccess: (data) => {
      if (data?.blocked) return;
      qc.invalidateQueries({ queryKey: ["production_orders"] });
      qc.invalidateQueries({ queryKey: ["wo_status_history"] });
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

      // Audit trail (forced)
      await supabase.from("wo_status_history").insert({
        production_order_id: order.id,
        status: "materials_allocated",
        notes: "Allocazione forzata con deficit di stock",
      });
    },
    onSuccess: () => {
      setStockWarning(null);
      qc.invalidateQueries({ queryKey: ["production_orders"] });
      qc.invalidateQueries({ queryKey: ["wo_status_history"] });
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
                <tr><td colSpan={8}><TableSkeleton rows={5} columns={6} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={Zap} message="Nessun ordine di produzione attivo." actionLabel="Nuovo ODP" onAction={() => setCreateOpen(true)} /></td></tr>
              ) : filtered.map(o => {
                const si = getStatusInfo(o.status);
                const pi = getPriorityInfo(o.priority || "normal");
                const currentIdx = WO_STATUSES.findIndex(s => s.value === o.status);
                const nextStatus = currentIdx < WO_STATUSES.length - 1 ? WO_STATUSES[currentIdx + 1] : null;
                return (
                  <tr key={o.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setDetailOrderId(o.id)}>
                    <td className="p-3 font-mono text-primary font-medium">{o.wo_number}</td>
                    <td className="p-3 font-mono text-xs">{getItemCode(o.product_item_id)}</td>
                    <td className="p-3 font-mono">{Number(o.quantity_to_produce)}</td>
                    <td className="p-3"><span className={cn("text-xs font-medium", pi.color)}>{pi.label}</span></td>
                    <td className="p-3"><Badge className={cn("text-xs", si.color)}>{si.label}</Badge></td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{o.planned_start || "—"}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{o.planned_end || "—"}</td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          title="Dettaglio"
                          onClick={() => setDetailOrderId(o.id)}>
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        {nextStatus && (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            disabled={updateStatusMut.isPending}
                            onClick={() => updateStatusMut.mutate({ id: o.id, status: nextStatus.value })}>
                            → {nextStatus.label}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Dialog with tabs */}
      <Dialog open={!!detailOrderId} onOpenChange={(open) => { if (!open) setDetailOrderId(null); }}>
        <DialogContent className="max-w-4xl w-[85vw] max-h-[90vh] flex flex-col">
          {(() => {
            const order = orders.find(o => o.id === detailOrderId);
            if (!order) return null;
            const si = getStatusInfo(order.status);
            const pi = getPriorityInfo(order.priority || "normal");
            const woStatusColorMap: Record<string, string> = {
              planned: "bg-muted-foreground",
              materials_allocated: "bg-blue-500",
              in_progress: "bg-orange-500",
              quality_check: "bg-indigo-500",
              completed: "bg-green-500",
              closed: "bg-green-700",
            };
            const currentIdx = WO_STATUSES.findIndex(st => st.value === order.status);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <span className="font-mono text-primary">{order.wo_number}</span>
                    <Badge className={cn("text-xs", si.color)}>{si.label}</Badge>
                    <span className={cn("text-xs font-medium ml-1", pi.color)}>{pi.label}</span>
                  </DialogTitle>
                </DialogHeader>

                {/* Info rapide */}
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <span className="text-muted-foreground block font-mono uppercase tracking-wider mb-1">Prodotto</span>
                    <span className="font-mono text-foreground">{getItemCode(order.product_item_id)}</span>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <span className="text-muted-foreground block font-mono uppercase tracking-wider mb-1">Quantità</span>
                    <span className="font-mono text-foreground">{Number(order.quantity_to_produce)}</span>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <span className="text-muted-foreground block font-mono uppercase tracking-wider mb-1">Inizio Piano</span>
                    <span className="font-mono text-foreground">{order.planned_start || "—"}</span>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <span className="text-muted-foreground block font-mono uppercase tracking-wider mb-1">Fine Piano</span>
                    <span className="font-mono text-foreground">{order.planned_end || "—"}</span>
                  </div>
                </div>

                <Tabs defaultValue="stato" className="flex-1 overflow-hidden flex flex-col mt-2">
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="stato">Stato</TabsTrigger>
                    <TabsTrigger value="componenti">
                      Componenti
                      {detailBomLines.length > 0 && (
                        <span className="ml-1 bg-primary/20 text-primary text-[10px] px-1.5 rounded-full">{detailBomLines.length}</span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="storico">
                      Storico
                      {woHistory.length > 0 && (
                        <span className="ml-1 bg-primary/20 text-primary text-[10px] px-1.5 rounded-full">{woHistory.length}</span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="note">Note</TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-y-auto mt-4">

                    {/* TAB 1: STATO */}
                    <TabsContent value="stato" className="mt-0 space-y-4">
                      <div className="bg-muted/30 rounded-lg p-4">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Avanzamento</h3>
                        <div className="flex items-center gap-1 flex-wrap">
                          {WO_STATUSES.map((s, i, arr) => {
                            const isCurrent = order.status === s.value;
                            const isPast = i < currentIdx;
                            return (
                              <div key={s.value} className="flex items-center gap-1">
                                <button
                                  onClick={() => !isCurrent && updateStatusMut.mutate({ id: order.id, status: s.value })}
                                  disabled={updateStatusMut.isPending || isCurrent}
                                  className={cn(
                                    "px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap transition-colors",
                                    isCurrent && "bg-primary text-primary-foreground",
                                    isPast && !isCurrent && "bg-muted text-foreground/60",
                                    !isPast && !isCurrent && "bg-muted/20 text-muted-foreground hover:bg-muted/50 cursor-pointer"
                                  )}
                                >{s.label}</button>
                                {i < arr.length - 1 && <span className="text-muted-foreground/30">→</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/30 rounded-lg p-3 text-xs">
                          <span className="text-muted-foreground block font-mono uppercase tracking-wider mb-1">Inizio Effettivo</span>
                          <span className="font-mono text-foreground">{order.actual_start || "Non iniziato"}</span>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3 text-xs">
                          <span className="text-muted-foreground block font-mono uppercase tracking-wider mb-1">Fine Effettiva</span>
                          <span className="font-mono text-foreground">{order.actual_end || "Non completato"}</span>
                        </div>
                      </div>
                    </TabsContent>

                    {/* TAB 2: COMPONENTI BOM */}
                    <TabsContent value="componenti" className="mt-0">
                      {!order.bom_header_id ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">Nessuna BOM collegata a questo ODP.</p>
                      ) : detailBomLines.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">BOM vuota.</p>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground mb-3">
                            Componenti necessari per produrre <span className="font-mono text-foreground">{Number(order.quantity_to_produce)}</span> unità
                          </p>
                          <div className="border border-border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border bg-muted/30">
                                  {["Codice", "Descrizione", "Qtà/Unità", "Scarto %", "Qtà Totale", "UM"].map(h => (
                                    <th key={h} className="text-left p-2 text-muted-foreground text-xs font-mono uppercase tracking-wider">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {detailBomLines.map((bl: any) => {
                                  const comp = items.find(i => i.id === bl.component_item_id);
                                  const totalQty = Number(bl.quantity) * Number(order.quantity_to_produce) * (1 + Number(bl.waste_pct || 0) / 100);
                                  return (
                                    <tr key={bl.id} className="hover:bg-muted/10">
                                      <td className="p-2 font-mono text-xs text-primary">{comp?.item_code || "?"}</td>
                                      <td className="p-2 text-xs text-muted-foreground">{comp?.description || ""}</td>
                                      <td className="p-2 text-right font-mono text-xs">{Number(bl.quantity)}</td>
                                      <td className="p-2 text-right font-mono text-xs text-muted-foreground">{Number(bl.waste_pct || 0)}%</td>
                                      <td className="p-2 text-right font-mono text-xs font-medium text-foreground">{totalQty.toFixed(2)}</td>
                                      <td className="p-2 font-mono text-xs text-muted-foreground">{comp?.unit_of_measure || "PZ"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </TabsContent>

                    {/* TAB 3: STORICO */}
                    <TabsContent value="storico" className="mt-0">
                      <div className="bg-muted/30 rounded-lg p-4">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                          <History className="h-3.5 w-3.5" /> Storico Stato
                        </h3>
                        {woHistory.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">Nessun cambio di stato registrato.</p>
                        ) : (
                          <div className="relative pl-4 space-y-3 border-l-2 border-border ml-1">
                            {woHistory.map((h: any) => {
                              const dotColor = woStatusColorMap[h.status] || "bg-muted-foreground";
                              const stepInfo = WO_STATUSES.find(s => s.value === h.status);
                              return (
                                <div key={h.id} className="relative flex items-start gap-3">
                                  <div className={cn("absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-background", dotColor)} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge className={cn("text-[10px]", stepInfo?.color || "")}>{stepInfo?.label || h.status}</Badge>
                                      <span className="font-mono text-[10px] text-muted-foreground">
                                        {new Date(h.created_at).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                    </div>
                                    {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* TAB 4: NOTE */}
                    <TabsContent value="note" className="mt-0">
                      <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground min-h-[120px]">
                        {order.notes || "Nessuna nota per questo ordine."}
                      </div>
                    </TabsContent>

                  </div>
                </Tabs>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Create WO Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl w-[80vw]">
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
