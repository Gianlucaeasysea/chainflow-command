import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Eye, Upload, Calendar, Clock, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CsvImportDialog from "@/components/CsvImportDialog";

const PO_STATUSES = [
  { value: "draft", label: "Bozza", color: "text-muted-foreground bg-muted/50" },
  { value: "sent", label: "Inviato", color: "status-info" },
  { value: "confirmed", label: "Confermato", color: "status-ok" },
  { value: "in_production", label: "In Produzione", color: "status-warning" },
  { value: "shipping", label: "In Spedizione", color: "status-info" },
  { value: "customs", label: "In Dogana", color: "status-warning" },
  { value: "delivered", label: "Consegnato", color: "status-ok" },
  { value: "closed", label: "Chiuso", color: "text-muted-foreground bg-muted/30" },
  { value: "cancelled", label: "Annullato", color: "status-critical" },
];

const INCOTERMS = ["EXW", "FOB", "CIF", "DDP", "FCA", "CPT"];

export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", currency: "EUR", incoterm: "EXW", shipping_port: "", requested_delivery_date: "", notes: "" });
  const [lineForm, setLineForm] = useState({ item_id: "", quantity: "1", unit_price: "0", discount_pct: "0", notes: "" });
  const [csvOpen, setCsvOpen] = useState(false);
  const [lineSearch, setLineSearch] = useState("");
  const qc = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => { const { data, error } = await supabase.from("suppliers").select("*").eq("is_active", true).order("company_name"); if (error) throw error; return data; },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => { const { data, error } = await supabase.from("items").select("*").order("item_code"); if (error) throw error; return data; },
  });

  const { data: supplierItems = [] } = useQuery({
    queryKey: ["supplier_items"],
    queryFn: async () => { const { data, error } = await supabase.from("supplier_items").select("*"); if (error) throw error; return data; },
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => { const { data, error } = await supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const { data: allPoLines = [] } = useQuery({
    queryKey: ["all_po_lines"],
    queryFn: async () => { const { data, error } = await supabase.from("po_lines").select("*"); if (error) throw error; return data; },
  });

  const { data: poLines = [] } = useQuery({
    queryKey: ["po_lines", detailId],
    queryFn: async () => {
      if (!detailId) return [];
      const { data, error } = await supabase.from("po_lines").select("*").eq("purchase_order_id", detailId).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!detailId,
  });

  const { data: statusHistory = [] } = useQuery({
    queryKey: ["po_status_history", detailId],
    queryFn: async () => {
      if (!detailId) return [];
      const { data, error } = await supabase.from("po_status_history").select("*").eq("purchase_order_id", detailId).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!detailId,
  });

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production_orders"],
    queryFn: async () => { const { data, error } = await supabase.from("production_orders").select("*"); if (error) throw error; return data; },
  });

  // Lead time calculations per item
  const leadTimeStats = useMemo(() => {
    const stats: Record<string, { avg: number; count: number; min: number; max: number }> = {};
    
    // For each delivered PO, calculate lead time per item
    orders.filter(o => o.actual_delivery_date && o.order_date).forEach(po => {
      const orderDate = new Date(po.order_date!);
      const deliveryDate = new Date(po.actual_delivery_date!);
      const days = Math.round((deliveryDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const linesForPo = allPoLines.filter(l => l.purchase_order_id === po.id);
      linesForPo.forEach(line => {
        if (!stats[line.item_id]) stats[line.item_id] = { avg: 0, count: 0, min: Infinity, max: 0 };
        const s = stats[line.item_id];
        s.count++;
        s.avg = ((s.avg * (s.count - 1)) + days) / s.count;
        s.min = Math.min(s.min, days);
        s.max = Math.max(s.max, days);
      });
    });
    return stats;
  }, [orders, allPoLines]);

  // End-to-end cycle: PO order date → Production order completion
  const cycleTimeStats = useMemo(() => {
    const results: Array<{
      productName: string;
      woNumber: string;
      poNumber: string;
      orderDate: string;
      deliveryDate: string;
      productionEnd: string;
      leadTimeDays: number;
      productionDays: number;
      totalDays: number;
    }> = [];

    productionOrders.filter(wo => wo.actual_end).forEach(wo => {
      const productItem = items.find(i => i.id === wo.product_item_id);
      // Find POs that contain components for this product (simplified: look at POs delivered before WO started)
      const relevantPOs = orders.filter(po => 
        po.actual_delivery_date && po.order_date &&
        allPoLines.some(l => l.purchase_order_id === po.id)
      );
      
      if (relevantPOs.length > 0) {
        // Use earliest PO order date as start
        const earliestPO = relevantPOs.reduce((earliest, po) => 
          new Date(po.order_date!) < new Date(earliest.order_date!) ? po : earliest
        );
        
        const orderDate = new Date(earliestPO.order_date!);
        const deliveryDate = new Date(earliestPO.actual_delivery_date!);
        const productionEnd = new Date(wo.actual_end!);
        
        const leadTimeDays = Math.round((deliveryDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        const productionDays = Math.round((productionEnd.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
        const totalDays = Math.round((productionEnd.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

        results.push({
          productName: productItem?.item_code || "?",
          woNumber: wo.wo_number,
          poNumber: earliestPO.po_number,
          orderDate: earliestPO.order_date!,
          deliveryDate: earliestPO.actual_delivery_date!,
          productionEnd: wo.actual_end!,
          leadTimeDays,
          productionDays,
          totalDays,
        });
      }
    });
    return results;
  }, [productionOrders, orders, allPoLines, items]);

  // Get supplier-specific price for selected item
  const getSupplierPrice = (itemId: string, supplierId: string) => {
    return supplierItems.find(si => si.item_id === itemId && si.supplier_id === supplierId);
  };

  const selectedOrder = orders.find(o => o.id === detailId);
  const selectedSupplierId = selectedOrder?.supplier_id || form.supplier_id;

  const createMut = useMutation({
    mutationFn: async () => {
      const poNum = `PO-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, "0")}`;
      const { data, error } = await supabase.from("purchase_orders").insert({
        po_number: poNum, supplier_id: form.supplier_id, currency: form.currency,
        incoterm: form.incoterm, shipping_port: form.shipping_port || null,
        requested_delivery_date: form.requested_delivery_date || null, notes: form.notes || null,
        order_date: new Date().toISOString().split("T")[0],
      }).select().single();
      if (error) throw error;
      await supabase.from("po_status_history").insert({ purchase_order_id: data.id, status: "draft", notes: "Ordine creato" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      setCreateOpen(false);
      setForm({ supplier_id: "", currency: "EUR", incoterm: "EXW", shipping_port: "", requested_delivery_date: "", notes: "" });
      toast.success("Ordine creato");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addLineMut = useMutation({
    mutationFn: async () => {
      const lineTotal = parseFloat(lineForm.quantity) * parseFloat(lineForm.unit_price) * (1 - parseFloat(lineForm.discount_pct) / 100);
      const { error } = await supabase.from("po_lines").insert({
        purchase_order_id: detailId!, item_id: lineForm.item_id,
        quantity: parseFloat(lineForm.quantity), unit_price: parseFloat(lineForm.unit_price),
        discount_pct: parseFloat(lineForm.discount_pct), notes: lineForm.notes || null,
        sort_order: poLines.length, line_total: lineTotal,
      });
      if (error) throw error;
      // Update PO total
      const newTotal = poLines.reduce((sum, l) => sum + Number(l.line_total || 0), 0) + lineTotal;
      await supabase.from("purchase_orders").update({ total_amount: newTotal }).eq("id", detailId!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po_lines", detailId] });
      qc.invalidateQueries({ queryKey: ["all_po_lines"] });
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      setAddLineOpen(false);
      setLineForm({ item_id: "", quantity: "1", unit_price: "0", discount_pct: "0", notes: "" });
      toast.success("Riga aggiunta");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const changeStatusMut = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      const updates: Record<string, any> = { status: newStatus };
      if (newStatus === "delivered") {
        updates.actual_delivery_date = new Date().toISOString().split("T")[0];
      }
      const { error: e1 } = await supabase.from("purchase_orders").update(updates).eq("id", orderId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("po_status_history").insert({ purchase_order_id: orderId, status: newStatus });
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["po_status_history", detailId] });
      toast.success("Stato aggiornato");
    },
  });

  const handleItemSelect = (itemId: string) => {
    setLineForm(prev => ({ ...prev, item_id: itemId }));
    // Auto-fill price from supplier_items if available
    if (selectedSupplierId) {
      const si = getSupplierPrice(itemId, selectedSupplierId);
      if (si?.unit_price) {
        setLineForm(prev => ({ ...prev, item_id: itemId, unit_price: String(si.unit_price) }));
      }
    }
    // Fallback to item unit_cost
    const item = items.find(i => i.id === itemId);
    if (item?.unit_cost && !getSupplierPrice(itemId, selectedSupplierId || "")?.unit_price) {
      setLineForm(prev => ({ ...prev, unit_price: String(item.unit_cost) }));
    }
  };

  const filtered = orders.filter(o => {
    const matchSearch = o.po_number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.company_name || "—";
  const getStatusInfo = (status: string) => PO_STATUSES.find(s => s.value === status) || PO_STATUSES[0];

  // Items filtered for add-line dialog
  const filteredItems = items.filter(i =>
    i.item_code.toLowerCase().includes(lineSearch.toLowerCase()) ||
    i.description.toLowerCase().includes(lineSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Ordini Fornitori</h1>
          <p className="text-sm text-muted-foreground">{orders.length} ordini</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCsvOpen(true)} className="gap-2"><Upload className="h-4 w-4" /> Importa CSV</Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Nuovo PO</Button>
        </div>
      </div>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList>
          <TabsTrigger value="orders">Ordini</TabsTrigger>
          <TabsTrigger value="leadtime" className="gap-1"><Clock className="h-3.5 w-3.5" /> Lead Time</TabsTrigger>
          <TabsTrigger value="cycle" className="gap-1"><TrendingUp className="h-3.5 w-3.5" /> Ciclo Completo</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cerca numero PO..." className="pl-9 font-mono text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                {PO_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["N° PO", "Fornitore", "Stato", "Data Ordine", "Consegna Richiesta", "Consegna Effettiva", "Lead Time", "Totale", ""].map(h => (
                      <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Caricamento...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nessun ordine</td></tr>
                  ) : filtered.map(o => {
                    const si = getStatusInfo(o.status);
                    const lt = o.order_date && o.actual_delivery_date
                      ? Math.round((new Date(o.actual_delivery_date).getTime() - new Date(o.order_date).getTime()) / (1000 * 60 * 60 * 24))
                      : null;
                    return (
                      <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-mono text-primary font-medium">{o.po_number}</td>
                        <td className="p-3 text-foreground">{getSupplierName(o.supplier_id)}</td>
                        <td className="p-3"><Badge className={cn("text-xs", si.color)}>{si.label}</Badge></td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{o.order_date || "—"}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{o.requested_delivery_date || "—"}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{o.actual_delivery_date || "—"}</td>
                        <td className="p-3 font-mono text-xs">
                          {lt !== null ? (
                            <Badge variant="outline" className={cn("font-mono", lt > 30 ? "border-destructive text-destructive" : "border-primary text-primary")}>
                              {lt}gg
                            </Badge>
                          ) : "—"}
                        </td>
                        <td className="p-3 font-mono text-foreground">€{Number(o.total_amount || 0).toLocaleString()}</td>
                        <td className="p-3">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailId(o.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* LEAD TIME TAB */}
        <TabsContent value="leadtime" className="space-y-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Lead Time per Componente
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Calcolato da data ordine a data consegna effettiva</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Codice", "Descrizione", "N° Ordini", "LT Medio (gg)", "LT Min", "LT Max"].map(h => (
                    <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.keys(leadTimeStats).length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">
                    Nessun dato. Segna gli ordini come "Consegnato" per calcolare il lead time.
                  </td></tr>
                ) : Object.entries(leadTimeStats).map(([itemId, s]) => {
                  const item = items.find(i => i.id === itemId);
                  return (
                    <tr key={itemId} className="hover:bg-muted/20">
                      <td className="p-3 font-mono text-primary text-xs">{item?.item_code || "?"}</td>
                      <td className="p-3 text-foreground text-xs">{item?.description || ""}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{s.count}</td>
                      <td className="p-3 font-mono text-foreground font-medium">{Math.round(s.avg)}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{s.min === Infinity ? "—" : s.min}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{s.max || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* CYCLE TIME TAB */}
        <TabsContent value="cycle" className="space-y-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Ciclo Completo: Ordine → Produzione → Prodotto Finito
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Tempo totale dall'ordine fornitore al completamento della produzione</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Prodotto", "WO", "PO", "Data Ordine", "Consegna Mat.", "Fine Produzione", "LT Fornitura", "Tempo Prod.", "Totale"].map(h => (
                    <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cycleTimeStats.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground text-xs">
                    Nessun dato. Completa ordini di produzione con date effettive per vedere il ciclo completo.
                  </td></tr>
                ) : cycleTimeStats.map((c, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="p-3 font-mono text-primary text-xs">{c.productName}</td>
                    <td className="p-3 font-mono text-xs">{c.woNumber}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{c.poNumber}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{c.orderDate}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{c.deliveryDate}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{c.productionEnd}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="font-mono text-xs">{c.leadTimeDays}gg</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="font-mono text-xs">{c.productionDays}gg</Badge>
                    </td>
                    <td className="p-3">
                      <Badge className={cn("font-mono text-xs", c.totalDays > 60 ? "status-critical" : c.totalDays > 30 ? "status-warning" : "status-ok")}>
                        {c.totalDays}gg
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* PO Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="font-mono">{selectedOrder.po_number}</span>
                  <Badge className={cn("text-xs", getStatusInfo(selectedOrder.status).color)}>{getStatusInfo(selectedOrder.status).label}</Badge>
                </DialogTitle>
              </DialogHeader>

              {/* Dates summary */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-muted/30 rounded-lg p-3">
                  <span className="text-muted-foreground block font-mono uppercase tracking-wider mb-1">Data Ordine</span>
                  <span className="font-mono text-foreground">{selectedOrder.order_date || "—"}</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <span className="text-muted-foreground block font-mono uppercase tracking-wider mb-1">Consegna Richiesta</span>
                  <span className="font-mono text-foreground">{selectedOrder.requested_delivery_date || "—"}</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <span className="text-muted-foreground block font-mono uppercase tracking-wider mb-1">Consegna Effettiva</span>
                  <span className="font-mono text-foreground">{selectedOrder.actual_delivery_date || "In attesa"}</span>
                  {selectedOrder.order_date && selectedOrder.actual_delivery_date && (
                    <Badge variant="outline" className="mt-1 font-mono text-[10px]">
                      LT: {Math.round((new Date(selectedOrder.actual_delivery_date).getTime() - new Date(selectedOrder.order_date).getTime()) / (1000 * 60 * 60 * 24))}gg
                    </Badge>
                  )}
                </div>
              </div>

              {/* Status Timeline */}
              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Timeline Stati</h3>
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                  {PO_STATUSES.filter(s => s.value !== "cancelled").map((s, i) => {
                    const historyEntry = statusHistory.find(h => h.status === s.value);
                    const isCurrent = selectedOrder.status === s.value;
                    const isPast = !!historyEntry;
                    return (
                      <div key={s.value} className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (!isCurrent) {
                              changeStatusMut.mutate({ orderId: selectedOrder.id, newStatus: s.value });
                            }
                          }}
                          className={cn(
                            "px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap transition-colors",
                            isCurrent && "bg-primary text-primary-foreground",
                            isPast && !isCurrent && "bg-muted text-foreground/60",
                            !isPast && !isCurrent && "bg-muted/20 text-muted-foreground hover:bg-muted/50 cursor-pointer"
                          )}
                        >
                          {s.label}
                        </button>
                        {i < PO_STATUSES.length - 2 && <span className="text-muted-foreground/30">→</span>}
                      </div>
                    );
                  })}
                </div>
                {statusHistory.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {statusHistory.map(h => (
                      <div key={h.id} className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-muted-foreground w-32">{new Date(h.created_at).toLocaleString("it-IT")}</span>
                        <Badge className={cn("text-[10px]", getStatusInfo(h.status).color)}>{getStatusInfo(h.status).label}</Badge>
                        {h.notes && <span className="text-muted-foreground">{h.notes}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PO Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Righe Ordine</h3>
                  <Button size="sm" onClick={() => setAddLineOpen(true)} className="gap-1 h-7 text-xs"><Plus className="h-3 w-3" /> Riga</Button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 text-muted-foreground text-xs font-mono">Articolo</th>
                      <th className="text-left p-2 text-muted-foreground text-xs font-mono">Descrizione</th>
                      <th className="text-right p-2 text-muted-foreground text-xs font-mono">Qtà</th>
                      <th className="text-right p-2 text-muted-foreground text-xs font-mono">Prezzo Unit.</th>
                      <th className="text-right p-2 text-muted-foreground text-xs font-mono">Sconto %</th>
                      <th className="text-right p-2 text-muted-foreground text-xs font-mono">Totale Riga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {poLines.length === 0 ? (
                      <tr><td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">Nessuna riga</td></tr>
                    ) : poLines.map(line => {
                      const item = items.find(i => i.id === line.item_id);
                      const lt = leadTimeStats[line.item_id];
                      return (
                        <tr key={line.id}>
                          <td className="p-2 font-mono text-xs text-primary">{item?.item_code || "?"}</td>
                          <td className="p-2 text-xs text-muted-foreground">{item?.description || ""}</td>
                          <td className="p-2 text-right font-mono">{Number(line.quantity)}</td>
                          <td className="p-2 text-right font-mono">€{Number(line.unit_price).toFixed(2)}</td>
                          <td className="p-2 text-right font-mono text-muted-foreground">{Number(line.discount_pct)}%</td>
                          <td className="p-2 text-right font-mono text-foreground">€{Number(line.line_total || 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {poLines.length > 0 && (
                      <tr className="bg-muted/20">
                        <td colSpan={5} className="p-2 text-right font-mono text-xs text-muted-foreground uppercase">Totale</td>
                        <td className="p-2 text-right font-mono font-semibold text-foreground">
                          €{poLines.reduce((sum, l) => sum + Number(l.line_total || 0), 0).toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create PO */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nuovo Ordine Fornitore</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
            <div>
              <Label>Fornitore *</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Valuta</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="GBP">GBP</SelectItem><SelectItem value="CNY">CNY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Incoterm</Label>
                <Select value={form.incoterm} onValueChange={(v) => setForm({ ...form, incoterm: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INCOTERMS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Consegna</Label>
                <Input type="date" className="font-mono" value={form.requested_delivery_date} onChange={(e) => setForm({ ...form, requested_delivery_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Porto di Spedizione</Label>
              <Input value={form.shipping_port} onChange={(e) => setForm({ ...form, shipping_port: e.target.value })} />
            </div>
            <div>
              <Label>Note</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={!form.supplier_id || createMut.isPending}>Crea Ordine</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add PO Line - Enhanced with item browser */}
      <Dialog open={addLineOpen} onOpenChange={setAddLineOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Aggiungi Riga Ordine</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addLineMut.mutate(); }} className="space-y-4">
            {/* Item search & selection */}
            <div>
              <Label>Cerca Articolo *</Label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cerca per codice o descrizione..." className="pl-9 text-sm" value={lineSearch} onChange={e => setLineSearch(e.target.value)} />
              </div>
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {filteredItems.map(item => {
                  const isSelected = lineForm.item_id === item.id;
                  const si = selectedSupplierId ? getSupplierPrice(item.id, selectedSupplierId) : null;
                  const lt = leadTimeStats[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemSelect(item.id)}
                      className={cn(
                        "w-full text-left p-3 flex items-center justify-between hover:bg-muted/30 transition-colors",
                        isSelected && "bg-primary/10 border-l-2 border-primary"
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-primary font-medium">{item.item_code}</span>
                          <span className="text-xs text-foreground">{item.description}</span>
                          {item.item_type && <Badge variant="outline" className="text-[10px]">{item.item_type}</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {item.unit_cost ? <span className="text-[10px] text-muted-foreground font-mono">Costo: €{Number(item.unit_cost).toFixed(2)}</span> : null}
                          {si?.unit_price ? <span className="text-[10px] text-primary font-mono">Prezzo fornitore: €{Number(si.unit_price).toFixed(2)}</span> : null}
                          {si?.moq ? <span className="text-[10px] text-muted-foreground font-mono">MOQ: {si.moq}</span> : null}
                          {si?.lead_time_days ? <span className="text-[10px] text-muted-foreground font-mono">LT: {si.lead_time_days}gg</span> : null}
                          {lt ? <span className="text-[10px] text-muted-foreground font-mono">LT reale: ~{Math.round(lt.avg)}gg</span> : null}
                        </div>
                      </div>
                      {isSelected && <Badge className="text-[10px] bg-primary text-primary-foreground">Selezionato</Badge>}
                    </button>
                  );
                })}
                {filteredItems.length === 0 && <div className="p-4 text-center text-muted-foreground text-xs">Nessun articolo trovato</div>}
              </div>
            </div>

            {/* Quantity, price, discount */}
            {lineForm.item_id && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/20 rounded-lg">
                <div>
                  <Label className="text-xs">Quantità</Label>
                  <Input type="number" step="0.01" className="font-mono" value={lineForm.quantity} onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Prezzo Unitario (€)</Label>
                  <Input type="number" step="0.01" className="font-mono" value={lineForm.unit_price} onChange={(e) => setLineForm({ ...lineForm, unit_price: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Sconto %</Label>
                  <Input type="number" step="0.01" className="font-mono" value={lineForm.discount_pct} onChange={(e) => setLineForm({ ...lineForm, discount_pct: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Note</Label>
                  <Input value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
                </div>
                <div className="flex items-end">
                  <div className="text-xs text-muted-foreground font-mono">
                    Totale: <span className="text-foreground font-semibold">
                      €{(parseFloat(lineForm.quantity || "0") * parseFloat(lineForm.unit_price || "0") * (1 - parseFloat(lineForm.discount_pct || "0") / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setAddLineOpen(false); setLineSearch(""); }}>Annulla</Button>
              <Button type="submit" disabled={!lineForm.item_id || addLineMut.isPending}>Aggiungi Riga</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} title="Importa Ordini Fornitori da CSV"
        expectedColumns={["fornitore", "valuta", "incoterm", "data_consegna", "note"]}
        onImport={async (rows) => {
          for (const r of rows) {
            const supplierName = r["fornitore"] || r["supplier"] || "";
            const supplier = suppliers.find(s => s.company_name.toLowerCase() === supplierName.toLowerCase());
            if (!supplier) continue;
            const poNum = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
            const { data, error } = await supabase.from("purchase_orders").insert({
              po_number: poNum, supplier_id: supplier.id,
              currency: r["valuta"] || r["currency"] || "EUR",
              incoterm: r["incoterm"] || "EXW",
              requested_delivery_date: r["data_consegna"] || r["delivery_date"] || null,
              notes: r["note"] || r["notes"] || null,
              order_date: new Date().toISOString().split("T")[0],
            }).select().single();
            if (error) throw error;
            await supabase.from("po_status_history").insert({ purchase_order_id: data.id, status: "draft", notes: "Importato da CSV" });
          }
          qc.invalidateQueries({ queryKey: ["purchase_orders"] });
        }} />
    </div>
  );
}
