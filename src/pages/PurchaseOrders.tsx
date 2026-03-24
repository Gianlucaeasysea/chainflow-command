import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Eye, Upload, Clock, TrendingUp, Package, Check, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  { value: "pre_series", label: "Pre-Serie", color: "bg-purple-500/20 text-purple-300" },
  { value: "in_production", label: "In Produzione", color: "status-warning" },
  { value: "shipping", label: "In Spedizione", color: "status-info" },
  { value: "customs", label: "In Dogana", color: "status-warning" },
  { value: "delivered", label: "Consegnato", color: "status-ok" },
  { value: "closed", label: "Chiuso", color: "text-muted-foreground bg-muted/30" },
  { value: "cancelled", label: "Annullato", color: "status-critical" },
];

const INCOTERMS = ["EXW", "FOB", "CIF", "DDP", "FCA", "CPT"];

type LineEntry = {
  item_id: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
  notes: string;
};

type DeliveryEntry = {
  tempId: string;
  item_id: string;   // empty = intero ordine
  scheduled_date: string;
  quantity: string;
  status: string;
  notes: string;
};

export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(0); // 0=header, 1=lines, 2=deliveries, 3=review
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", currency: "EUR", incoterm: "EXW", shipping_port: "", requested_delivery_date: "", notes: "", is_pre_series: false });
  const [createLines, setCreateLines] = useState<LineEntry[]>([]);
  const [createDeliveries, setCreateDeliveries] = useState<DeliveryEntry[]>([]);
  const [lineSearch, setLineSearch] = useState("");
  const [detailLineSearch, setDetailLineSearch] = useState("");
  const [detailLineForm, setDetailLineForm] = useState<LineEntry>({ item_id: "", quantity: "1", unit_price: "0", discount_pct: "0", notes: "" });
  const [csvOpen, setCsvOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({ scheduled_date: "", quantity: "0", status: "scheduled", notes: "", po_line_id: "" });
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

  const { data: poDeliveries = [] } = useQuery({
    queryKey: ["po_deliveries", detailId],
    queryFn: async () => {
      if (!detailId) return [];
      const { data, error } = await (supabase.from as any)("po_deliveries").select("*").eq("purchase_order_id", detailId).order("scheduled_date");
      if (error) { console.warn("po_deliveries:", error.message); return []; }
      return data;
    },
    enabled: !!detailId,
  });

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production_orders"],
    queryFn: async () => { const { data, error } = await supabase.from("production_orders").select("*"); if (error) throw error; return data; },
  });

  // Lead time per item
  const leadTimeStats = useMemo(() => {
    const stats: Record<string, { avg: number; count: number; min: number; max: number }> = {};
    orders.filter(o => o.actual_delivery_date && o.order_date).forEach(po => {
      const days = Math.round((new Date(po.actual_delivery_date!).getTime() - new Date(po.order_date!).getTime()) / 86400000);
      allPoLines.filter(l => l.purchase_order_id === po.id).forEach(line => {
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

  // Cycle time stats
  const cycleTimeStats = useMemo(() => {
    return productionOrders.filter(wo => wo.actual_end).map(wo => {
      const productItem = items.find(i => i.id === wo.product_item_id);
      const relevantPOs = orders.filter(po => po.actual_delivery_date && po.order_date);
      if (relevantPOs.length === 0) return null;
      const earliestPO = relevantPOs.reduce((e, po) => new Date(po.order_date!) < new Date(e.order_date!) ? po : e);
      const orderDate = new Date(earliestPO.order_date!);
      const deliveryDate = new Date(earliestPO.actual_delivery_date!);
      const productionEnd = new Date(wo.actual_end!);
      return {
        productName: productItem?.item_code || "?",
        woNumber: wo.wo_number,
        poNumber: earliestPO.po_number,
        orderDate: earliestPO.order_date!,
        deliveryDate: earliestPO.actual_delivery_date!,
        productionEnd: wo.actual_end!,
        leadTimeDays: Math.round((deliveryDate.getTime() - orderDate.getTime()) / 86400000),
        productionDays: Math.round((productionEnd.getTime() - deliveryDate.getTime()) / 86400000),
        totalDays: Math.round((productionEnd.getTime() - orderDate.getTime()) / 86400000),
      };
    }).filter(Boolean) as any[];
  }, [productionOrders, orders, items]);

  const getSupplierPrice = (itemId: string, supplierId: string) =>
    supplierItems.find(si => si.item_id === itemId && si.supplier_id === supplierId);

  const selectedOrder = orders.find(o => o.id === detailId);

  // --- MUTATIONS ---

  const createMut = useMutation({
    mutationFn: async () => {
      const poNum = `PO-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, "0")}`;
      const initialStatus = form.is_pre_series ? "pre_series" : "draft";
      const { data, error } = await supabase.from("purchase_orders").insert({
        po_number: poNum, supplier_id: form.supplier_id, currency: form.currency,
        incoterm: form.incoterm, shipping_port: form.shipping_port || null,
        requested_delivery_date: form.requested_delivery_date || null,
        notes: form.notes || null,
        order_date: new Date().toISOString().split("T")[0],
        status: initialStatus,
      }).select().single();
      if (error) throw error;

      // Insert lines (without line_total — it's generated)
      let createdLines: any[] = [];
      if (createLines.length > 0) {
        const rows = createLines.map((l, i) => ({
          purchase_order_id: data.id,
          item_id: l.item_id,
          quantity: parseFloat(l.quantity),
          unit_price: parseFloat(l.unit_price),
          discount_pct: parseFloat(l.discount_pct),
          notes: l.notes || null,
          sort_order: i,
        }));
        const { data: linesData, error: lineErr } = await supabase.from("po_lines").insert(rows).select();
        if (lineErr) throw lineErr;
        createdLines = linesData || [];
      }

      // Insert programmed deliveries
      const validDeliveries = createDeliveries.filter(d => d.scheduled_date && parseFloat(d.quantity) > 0);
      if (validDeliveries.length > 0) {
        const deliveryRows = validDeliveries.map(d => ({
          purchase_order_id: data.id,
          po_line_id: d.item_id ? (createdLines.find((l: any) => l.item_id === d.item_id)?.id || null) : null,
          scheduled_date: d.scheduled_date,
          quantity: parseFloat(d.quantity),
          status: d.status,
          notes: d.notes || null,
        }));
        const { error: deliveryErr } = await (supabase.from as any)("po_deliveries").insert(deliveryRows);
        if (deliveryErr) throw deliveryErr;
      }

      await supabase.from("po_status_history").insert({
        purchase_order_id: data.id, status: initialStatus,
        notes: form.is_pre_series ? "Ordine pre-serie creato" : "Ordine creato",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["all_po_lines"] });
      qc.invalidateQueries({ queryKey: ["po_deliveries"] });
      resetCreateForm();
      toast.success("Ordine creato");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addLineMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("po_lines").insert({
        purchase_order_id: detailId!,
        item_id: detailLineForm.item_id,
        quantity: parseFloat(detailLineForm.quantity),
        unit_price: parseFloat(detailLineForm.unit_price),
        discount_pct: parseFloat(detailLineForm.discount_pct),
        notes: detailLineForm.notes || null,
        sort_order: poLines.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po_lines", detailId] });
      qc.invalidateQueries({ queryKey: ["all_po_lines"] });
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      setAddLineOpen(false);
      setDetailLineForm({ item_id: "", quantity: "1", unit_price: "0", discount_pct: "0", notes: "" });
      toast.success("Riga aggiunta");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const changeStatusMut = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      const updates: Record<string, any> = { status: newStatus };
      if (newStatus === "delivered") updates.actual_delivery_date = new Date().toISOString().split("T")[0];
      const { error: e1 } = await supabase.from("purchase_orders").update(updates).eq("id", orderId);
      if (e1) throw e1;
      await supabase.from("po_status_history").insert({ purchase_order_id: orderId, status: newStatus });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["po_status_history", detailId] });
      toast.success("Stato aggiornato");
    },
  });

  const addDeliveryMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("po_deliveries").insert({
        purchase_order_id: detailId!,
        po_line_id: deliveryForm.po_line_id || null,
        scheduled_date: deliveryForm.scheduled_date,
        quantity: parseFloat(deliveryForm.quantity),
        status: deliveryForm.status,
        notes: deliveryForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po_deliveries", detailId] });
      qc.invalidateQueries({ queryKey: ["po_deliveries"] });
      setDeliveryOpen(false);
      setDeliveryForm({ scheduled_date: "", quantity: "0", status: "scheduled", notes: "", po_line_id: "" });
      toast.success("Consegna programmata");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteDeliveryMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("po_deliveries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po_deliveries", detailId] });
      qc.invalidateQueries({ queryKey: ["po_deliveries"] });
      toast.success("Consegna rimossa");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: async (orderId: string) => {
      // Scollega i lotti inventario (FK nullable)
      const { error: e0 } = await supabase.from("inventory_lots").update({ purchase_order_id: null }).eq("purchase_order_id", orderId);
      if (e0) throw e0;
      const { error: e1 } = await supabase.from("po_status_history").delete().eq("purchase_order_id", orderId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("po_lines").delete().eq("purchase_order_id", orderId);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("purchase_orders").delete().eq("id", orderId);
      if (e3) throw e3;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["all_po_lines"] });
      setDetailId(null);
      setDeleteConfirmId(null);
      toast.success("Ordine eliminato");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // --- HELPERS ---

  const resetCreateForm = () => {
    setCreateOpen(false);
    setCreateStep(0);
    setCreateLines([]);
    setCreateDeliveries([]);
    setLineSearch("");
    setForm({ supplier_id: "", currency: "EUR", incoterm: "EXW", shipping_port: "", requested_delivery_date: "", notes: "", is_pre_series: false });
  };

  const toggleCreateLine = (itemId: string) => {
    setCreateLines(prev => {
      const existing = prev.find(l => l.item_id === itemId);
      if (existing) return prev.filter(l => l.item_id !== itemId);
      const item = items.find(i => i.id === itemId);
      const si = form.supplier_id ? getSupplierPrice(itemId, form.supplier_id) : null;
      const price = si?.unit_price ? String(si.unit_price) : item?.unit_cost ? String(item.unit_cost) : "0";
      return [...prev, { item_id: itemId, quantity: "1", unit_price: price, discount_pct: "0", notes: "" }];
    });
  };

  const updateCreateLine = (itemId: string, field: keyof LineEntry, value: string) => {
    setCreateLines(prev => prev.map(l => l.item_id === itemId ? { ...l, [field]: value } : l));
  };

  const calcLineTotal = (l: LineEntry) =>
    (parseFloat(l.quantity || "0") * parseFloat(l.unit_price || "0") * (1 - parseFloat(l.discount_pct || "0") / 100));

  const filtered = orders.filter(o => {
    const matchSearch = o.po_number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.company_name || "—";
  const getStatusInfo = (status: string) => PO_STATUSES.find(s => s.value === status) || PO_STATUSES[0];
  const getItem = (id: string) => items.find(i => i.id === id);

  const filteredCreateItems = items.filter(i =>
    i.item_code.toLowerCase().includes(lineSearch.toLowerCase()) ||
    i.description.toLowerCase().includes(lineSearch.toLowerCase())
  );

  const filteredDetailItems = items.filter(i =>
    i.item_code.toLowerCase().includes(detailLineSearch.toLowerCase()) ||
    i.description.toLowerCase().includes(detailLineSearch.toLowerCase())
  );

  const createTotal = createLines.reduce((sum, l) => sum + calcLineTotal(l), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Ordini Fornitori</h1>
          <p className="text-sm text-muted-foreground">{orders.length} ordini</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCsvOpen(true)} className="gap-2"><Upload className="h-4 w-4" /> Importa</Button>
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
              <Input placeholder="Cerca PO..." className="pl-9 font-mono text-sm" value={search} onChange={e => setSearch(e.target.value)} />
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
                    {["N° PO", "Fornitore", "Stato", "Data Ordine", "Consegna Rich.", "Consegna Eff.", "LT", "Totale", ""].map(h => (
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
                      ? Math.round((new Date(o.actual_delivery_date).getTime() - new Date(o.order_date).getTime()) / 86400000) : null;
                    return (
                      <tr key={o.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setDetailId(o.id)}>
                        <td className="p-3 font-mono text-primary font-medium">{o.po_number}</td>
                        <td className="p-3 text-foreground">{getSupplierName(o.supplier_id)}</td>
                        <td className="p-3"><Badge className={cn("text-xs", si.color)}>{si.label}</Badge></td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{o.order_date || "—"}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{o.requested_delivery_date || "—"}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{o.actual_delivery_date || "—"}</td>
                        <td className="p-3 font-mono text-xs">
                          {lt !== null ? <Badge variant="outline" className={cn("font-mono", lt > 30 ? "border-destructive text-destructive" : "border-primary text-primary")}>{lt}gg</Badge> : "—"}
                        </td>
                        <td className="p-3 font-mono text-foreground">€{Number(o.total_amount || 0).toLocaleString()}</td>
                        <td className="p-3 flex items-center gap-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <button
                            onClick={(e) => { e.stopPropagation(); if (window.confirm(`Eliminare ${o.po_number}? Questa operazione è irreversibile.`)) deleteMut.mutate(o.id); }}
                            className="text-destructive/60 hover:text-destructive transition-colors"
                            title="Elimina ordine"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
        <TabsContent value="leadtime">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Lead Time per Componente</h3>
              <p className="text-xs text-muted-foreground mt-1">Da data ordine a consegna effettiva</p>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/30">
                {["Codice", "Descrizione", "Ordini", "LT Medio", "Min", "Max"].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-border">
                {Object.keys(leadTimeStats).length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">Segna ordini come "Consegnato" per calcolare il lead time.</td></tr>
                ) : Object.entries(leadTimeStats).map(([itemId, s]) => {
                  const item = getItem(itemId);
                  return (
                    <tr key={itemId} className="hover:bg-muted/20">
                      <td className="p-3 font-mono text-primary text-xs">{item?.item_code || "?"}</td>
                      <td className="p-3 text-foreground text-xs">{item?.description || ""}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{s.count}</td>
                      <td className="p-3 font-mono text-foreground font-medium">{Math.round(s.avg)}gg</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{s.min === Infinity ? "—" : `${s.min}gg`}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{s.max ? `${s.max}gg` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* CYCLE TIME TAB */}
        <TabsContent value="cycle">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Ordine → Produzione → Prodotto Finito</h3>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/30">
                {["Prodotto", "WO", "PO", "Ordine", "Consegna", "Fine Prod.", "LT Forn.", "Prod.", "Totale"].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-border">
                {cycleTimeStats.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground text-xs">Completa ordini di produzione per vedere i dati.</td></tr>
                ) : cycleTimeStats.map((c, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="p-3 font-mono text-primary text-xs">{c.productName}</td>
                    <td className="p-3 font-mono text-xs">{c.woNumber}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{c.poNumber}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{c.orderDate}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{c.deliveryDate}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{c.productionEnd}</td>
                    <td className="p-3"><Badge variant="outline" className="font-mono text-xs">{c.leadTimeDays}gg</Badge></td>
                    <td className="p-3"><Badge variant="outline" className="font-mono text-xs">{c.productionDays}gg</Badge></td>
                    <td className="p-3"><Badge className={cn("font-mono text-xs", c.totalDays > 60 ? "status-critical" : c.totalDays > 30 ? "status-warning" : "status-ok")}>{c.totalDays}gg</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ========== CREATE PO - MULTI STEP ========== */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetCreateForm(); else setCreateOpen(true); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              Nuovo Ordine Fornitore
              <div className="flex items-center gap-1 ml-auto">
                {["Intestazione", "Prodotti", "Consegne", "Riepilogo"].map((s, i) => (
                  <span key={s} className={cn("text-[10px] px-2 py-0.5 rounded font-mono", createStep === i ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground")}>{s}</span>
                ))}
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* STEP 0: Header */}
          {createStep === 0 && (
            <div className="space-y-4">
              <div>
                <Label>Fornitore *</Label>
                <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona fornitore..." /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Valuta</Label>
                  <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["EUR", "USD", "GBP", "CNY"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Incoterm</Label>
                  <Select value={form.incoterm} onValueChange={v => setForm({ ...form, incoterm: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INCOTERMS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Consegna richiesta</Label>
                  <Input type="date" className="font-mono" value={form.requested_delivery_date} onChange={e => setForm({ ...form, requested_delivery_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Porto di Spedizione</Label>
                <Input value={form.shipping_port} onChange={e => setForm({ ...form, shipping_port: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg">
                <Checkbox checked={form.is_pre_series} onCheckedChange={(v) => setForm({ ...form, is_pre_series: !!v })} id="preseries" />
                <Label htmlFor="preseries" className="cursor-pointer text-sm">
                  Ordine Pre-Serie <span className="text-muted-foreground text-xs ml-1">— aggiunge step "Pre-Serie" prima della produzione</span>
                </Label>
              </div>
              <div>
                <Label>Note</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetCreateForm}>Annulla</Button>
                <Button disabled={!form.supplier_id} onClick={() => setCreateStep(1)} className="gap-1">
                  Avanti — Prodotti <Package className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 1: Select products */}
          {createStep === 1 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cerca articoli per codice o descrizione..." className="pl-9 text-sm" value={lineSearch} onChange={e => setLineSearch(e.target.value)} />
              </div>

              <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {filteredCreateItems.map(item => {
                  const isSelected = createLines.some(l => l.item_id === item.id);
                  const si = getSupplierPrice(item.id, form.supplier_id);
                  const lt = leadTimeStats[item.id];
                  return (
                    <div key={item.id} className={cn("flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors cursor-pointer", isSelected && "bg-primary/10")}
                      onClick={() => toggleCreateLine(item.id)}>
                      <Checkbox checked={isSelected} className="pointer-events-none" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-primary font-medium">{item.item_code}</span>
                          <span className="text-xs text-foreground truncate">{item.description}</span>
                          {item.item_type && <Badge variant="outline" className="text-[10px] shrink-0">{item.item_type}</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {si?.unit_price && <span className="text-[10px] text-primary font-mono">€{Number(si.unit_price).toFixed(2)}</span>}
                          {!si?.unit_price && item.unit_cost ? <span className="text-[10px] text-muted-foreground font-mono">€{Number(item.unit_cost).toFixed(2)}</span> : null}
                          {si?.moq && <span className="text-[10px] text-muted-foreground font-mono">MOQ:{si.moq}</span>}
                          {si?.lead_time_days && <span className="text-[10px] text-muted-foreground font-mono">LT:{si.lead_time_days}gg</span>}
                          {lt && <span className="text-[10px] text-muted-foreground font-mono">LT reale:~{Math.round(lt.avg)}gg</span>}
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  );
                })}
                {filteredCreateItems.length === 0 && <div className="p-4 text-center text-muted-foreground text-xs">Nessun articolo trovato</div>}
              </div>

              {/* Selected items with quantity/price */}
              {createLines.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    {createLines.length} articol{createLines.length > 1 ? "i" : "o"} selezionat{createLines.length > 1 ? "i" : "o"}
                  </h4>
                  <div className="space-y-2">
                    {createLines.map(line => {
                      const item = getItem(line.item_id);
                      return (
                        <div key={line.item_id} className="p-3 bg-muted/20 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-primary">{item?.item_code}</span>
                            <span className="text-xs text-foreground">{item?.description}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <Label className="text-[10px]">Qtà</Label>
                              <Input type="number" step="0.01" className="font-mono h-8 text-xs" value={line.quantity} onChange={e => updateCreateLine(line.item_id, "quantity", e.target.value)} />
                            </div>
                            <div>
                              <Label className="text-[10px]">Prezzo €</Label>
                              <Input type="number" step="0.01" className="font-mono h-8 text-xs" value={line.unit_price} onChange={e => updateCreateLine(line.item_id, "unit_price", e.target.value)} />
                            </div>
                            <div>
                              <Label className="text-[10px]">Sconto %</Label>
                              <Input type="number" step="0.01" className="font-mono h-8 text-xs" value={line.discount_pct} onChange={e => updateCreateLine(line.item_id, "discount_pct", e.target.value)} />
                            </div>
                            <div className="flex items-end">
                              <span className="text-xs font-mono text-foreground font-semibold pb-1.5">€{calcLineTotal(line).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <Button variant="outline" onClick={() => setCreateStep(0)}>← Indietro</Button>
                <div className="flex items-center gap-3">
                  {createLines.length > 0 && <span className="font-mono text-sm text-foreground">Totale: <strong>€{createTotal.toFixed(2)}</strong></span>}
                  <Button disabled={createLines.length === 0} onClick={() => setCreateStep(2)}>Consegne →</Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Delivery scheduling */}
          {createStep === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Aggiungi le consegne scadenziabili per questo ordine. Puoi saltare questo step e aggiungerle in seguito.
              </p>

              {/* Per-item coverage summary */}
              <div className="grid grid-cols-2 gap-2">
                {createLines.map(line => {
                  const item = getItem(line.item_id);
                  const ordered = parseFloat(line.quantity);
                  const scheduled = createDeliveries
                    .filter(d => d.item_id === line.item_id || d.item_id === "")
                    .reduce((s, d) => s + (parseFloat(d.quantity) || 0), 0);
                  const pct = ordered > 0 ? Math.min(100, Math.round((scheduled / ordered) * 100)) : 0;
                  return (
                    <div key={line.item_id} className="bg-muted/20 rounded-lg p-2 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-primary">{item?.item_code}</span>
                        <span className="text-muted-foreground font-mono">{scheduled}/{ordered} {item?.unit_of_measure}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-primary" : "bg-muted")} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Delivery rows */}
              {createDeliveries.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border bg-muted/30">
                      {["Articolo", "Data", "Qtà", "Stato", "Note", ""].map(h => (
                        <th key={h} className="text-left p-2 font-mono text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-border">
                      {createDeliveries.map(d => (
                        <tr key={d.tempId}>
                          <td className="p-2">
                            <Select value={d.item_id} onValueChange={v => setCreateDeliveries(prev => prev.map(x => x.tempId === d.tempId ? { ...x, item_id: v } : x))}>
                              <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Intero ordine" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">Intero ordine</SelectItem>
                                {createLines.map(l => {
                                  const it = getItem(l.item_id);
                                  return <SelectItem key={l.item_id} value={l.item_id}>{it?.item_code}</SelectItem>;
                                })}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <Input type="date" className="font-mono h-7 text-xs w-36" value={d.scheduled_date}
                              onChange={e => setCreateDeliveries(prev => prev.map(x => x.tempId === d.tempId ? { ...x, scheduled_date: e.target.value } : x))} />
                          </td>
                          <td className="p-2">
                            <Input type="number" step="0.01" min="0" className="font-mono h-7 text-xs w-24" value={d.quantity}
                              onChange={e => setCreateDeliveries(prev => prev.map(x => x.tempId === d.tempId ? { ...x, quantity: e.target.value } : x))} />
                          </td>
                          <td className="p-2">
                            <Select value={d.status} onValueChange={v => setCreateDeliveries(prev => prev.map(x => x.tempId === d.tempId ? { ...x, status: v } : x))}>
                              <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[["scheduled","Programmata"],["in_transit","In Transito"],["received","Ricevuta"],["delayed","In Ritardo"]].map(([val, label]) => (
                                  <SelectItem key={val} value={val}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <Input className="h-7 text-xs" placeholder="nota..." value={d.notes}
                              onChange={e => setCreateDeliveries(prev => prev.map(x => x.tempId === d.tempId ? { ...x, notes: e.target.value } : x))} />
                          </td>
                          <td className="p-2">
                            <button onClick={() => setCreateDeliveries(prev => prev.filter(x => x.tempId !== d.tempId))}
                              className="text-destructive/50 hover:text-destructive transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="gap-1 w-full"
                onClick={() => {
                  const firstItem = createLines[0]?.item_id || "";
                  setCreateDeliveries(prev => [...prev, {
                    tempId: crypto.randomUUID(),
                    item_id: firstItem,
                    scheduled_date: form.requested_delivery_date || "",
                    quantity: createLines.find(l => l.item_id === firstItem)?.quantity || "0",
                    status: "scheduled",
                    notes: "",
                  }]);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Aggiungi consegna
              </Button>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCreateStep(1)}>← Prodotti</Button>
                <Button onClick={() => setCreateStep(3)}>Riepilogo →</Button>
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {createStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/20 rounded-lg p-3">
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">Fornitore</span>
                  <p className="text-sm text-foreground">{getSupplierName(form.supplier_id)}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">Condizioni</span>
                  <p className="text-sm text-foreground">{form.currency} · {form.incoterm}</p>
                </div>
                {form.requested_delivery_date && (
                  <div className="bg-muted/20 rounded-lg p-3">
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">Consegna</span>
                    <p className="text-sm font-mono text-foreground">{form.requested_delivery_date}</p>
                  </div>
                )}
                {form.is_pre_series && (
                  <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
                    <span className="text-[10px] text-purple-300 font-mono uppercase">Pre-Serie</span>
                    <p className="text-sm text-purple-200">Step pre-serie incluso</p>
                  </div>
                )}
              </div>

              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground text-xs font-mono">Articolo</th>
                  <th className="text-right p-2 text-muted-foreground text-xs font-mono">Qtà</th>
                  <th className="text-right p-2 text-muted-foreground text-xs font-mono">Prezzo</th>
                  <th className="text-right p-2 text-muted-foreground text-xs font-mono">Sconto</th>
                  <th className="text-right p-2 text-muted-foreground text-xs font-mono">Totale</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {createLines.map(line => {
                    const item = getItem(line.item_id);
                    return (
                      <tr key={line.item_id}>
                        <td className="p-2"><span className="font-mono text-xs text-primary">{item?.item_code}</span> <span className="text-xs text-muted-foreground">{item?.description}</span></td>
                        <td className="p-2 text-right font-mono text-xs">{line.quantity}</td>
                        <td className="p-2 text-right font-mono text-xs">€{parseFloat(line.unit_price).toFixed(2)}</td>
                        <td className="p-2 text-right font-mono text-xs text-muted-foreground">{line.discount_pct}%</td>
                        <td className="p-2 text-right font-mono text-xs font-medium">€{calcLineTotal(line).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/20">
                    <td colSpan={4} className="p-2 text-right font-mono text-xs text-muted-foreground uppercase">Totale Ordine</td>
                    <td className="p-2 text-right font-mono font-bold text-foreground">€{createTotal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Deliveries summary if any */}
              {createDeliveries.filter(d => d.scheduled_date).length > 0 && (
                <div className="bg-muted/20 rounded-lg p-3 space-y-1">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Consegne programmate</h4>
                  {createDeliveries.filter(d => d.scheduled_date).map(d => {
                    const it = d.item_id ? getItem(d.item_id) : null;
                    return (
                      <div key={d.tempId} className="flex items-center gap-3 text-xs">
                        <span className="font-mono text-primary w-24">{d.scheduled_date}</span>
                        <span className="text-muted-foreground">{it ? it.item_code : "Intero ordine"}</span>
                        <span className="font-mono ml-auto">{d.quantity} pz</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCreateStep(2)}>← Consegne</Button>
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="gap-1">
                  <Check className="h-4 w-4" /> Crea Ordine
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========== PO DETAIL ========== */}
      <Dialog open={!!detailId} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="font-mono">{selectedOrder.po_number}</span>
                  <Badge className={cn("text-xs", getStatusInfo(selectedOrder.status).color)}>{getStatusInfo(selectedOrder.status).label}</Badge>
                  <button
                    onClick={() => { if (window.confirm(`Eliminare ${selectedOrder.po_number}? Questa operazione è irreversibile.`)) { setDetailId(null); deleteMut.mutate(selectedOrder.id); } }}
                    className="ml-auto text-destructive/60 hover:text-destructive transition-colors"
                    title="Elimina ordine"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </DialogTitle>
              </DialogHeader>

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
                      LT: {Math.round((new Date(selectedOrder.actual_delivery_date).getTime() - new Date(selectedOrder.order_date).getTime()) / 86400000)}gg
                    </Badge>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Timeline</h3>
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                  {PO_STATUSES.filter(s => s.value !== "cancelled").map((s, i, arr) => {
                    const historyEntry = statusHistory.find(h => h.status === s.value);
                    const isCurrent = selectedOrder.status === s.value;
                    const isPast = !!historyEntry;
                    return (
                      <div key={s.value} className="flex items-center gap-1">
                        <button
                          onClick={() => { if (!isCurrent) changeStatusMut.mutate({ orderId: selectedOrder.id, newStatus: s.value }); }}
                          className={cn(
                            "px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap transition-colors",
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

              {/* Consegne Programmate */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" /> Consegne Programmate
                  </h3>
                  <Button size="sm" onClick={() => setDeliveryOpen(true)} className="gap-1 h-7 text-xs"><Plus className="h-3 w-3" /> Aggiungi</Button>
                </div>
                {poDeliveries.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Nessuna consegna programmata — aggiungi date di consegna scadenziata.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border">
                      {["Data", "Qtà", "Stato", "Note", ""].map(h => (
                        <th key={h} className="text-left p-2 text-muted-foreground text-xs font-mono">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-border">
                      {poDeliveries.map((d: any) => {
                        const statusColors: Record<string, string> = {
                          scheduled: "status-info", in_transit: "status-warning",
                          received: "status-ok", delayed: "status-critical",
                        };
                        const statusLabels: Record<string, string> = {
                          scheduled: "Programmata", in_transit: "In Transito",
                          received: "Ricevuta", delayed: "In Ritardo",
                        };
                        return (
                          <tr key={d.id}>
                            <td className="p-2 font-mono text-xs">{d.scheduled_date}</td>
                            <td className="p-2 font-mono text-xs">{Number(d.quantity)}</td>
                            <td className="p-2"><Badge className={cn("text-xs", statusColors[d.status] || "status-info")}>{statusLabels[d.status] || d.status}</Badge></td>
                            <td className="p-2 text-xs text-muted-foreground">{d.notes || "—"}</td>
                            <td className="p-2">
                              <button
                                onClick={() => { if (window.confirm(`Rimuovere consegna del ${d.scheduled_date}?`)) deleteDeliveryMut.mutate(d.id); }}
                                className="text-destructive/50 hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Righe Ordine</h3>
                  <Button size="sm" onClick={() => setAddLineOpen(true)} className="gap-1 h-7 text-xs"><Plus className="h-3 w-3" /> Aggiungi</Button>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    {["Articolo", "Descrizione", "Qtà", "Prezzo", "Sconto", "Totale"].map(h => (
                      <th key={h} className="text-left p-2 text-muted-foreground text-xs font-mono">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {poLines.length === 0 ? (
                      <tr><td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">Nessuna riga</td></tr>
                    ) : poLines.map(line => {
                      const item = getItem(line.item_id);
                      return (
                        <tr key={line.id}>
                          <td className="p-2 font-mono text-xs text-primary">{item?.item_code || "?"}</td>
                          <td className="p-2 text-xs text-muted-foreground">{item?.description || ""}</td>
                          <td className="p-2 text-right font-mono text-xs">{Number(line.quantity)}</td>
                          <td className="p-2 text-right font-mono text-xs">€{Number(line.unit_price).toFixed(2)}</td>
                          <td className="p-2 text-right font-mono text-xs text-muted-foreground">{Number(line.discount_pct)}%</td>
                          <td className="p-2 text-right font-mono text-xs font-medium">€{Number(line.line_total || 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {poLines.length > 0 && (
                      <tr className="bg-muted/20">
                        <td colSpan={5} className="p-2 text-right font-mono text-xs text-muted-foreground uppercase">Totale</td>
                        <td className="p-2 text-right font-mono font-bold text-foreground">€{poLines.reduce((s, l) => s + Number(l.line_total || 0), 0).toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ADD LINE TO EXISTING PO */}
      <Dialog open={addLineOpen} onOpenChange={setAddLineOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Aggiungi Riga</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); addLineMut.mutate(); }} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cerca articolo..." className="pl-9 text-sm" value={detailLineSearch} onChange={e => setDetailLineSearch(e.target.value)} />
            </div>
            <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {filteredDetailItems.map(item => {
                const isSelected = detailLineForm.item_id === item.id;
                const si = selectedOrder ? getSupplierPrice(item.id, selectedOrder.supplier_id) : null;
                return (
                  <div key={item.id} className={cn("p-3 flex items-center gap-3 hover:bg-muted/30 cursor-pointer", isSelected && "bg-primary/10")}
                    onClick={() => {
                      const price = si?.unit_price ? String(si.unit_price) : item.unit_cost ? String(item.unit_cost) : "0";
                      setDetailLineForm({ ...detailLineForm, item_id: item.id, unit_price: price });
                    }}>
                    <div className="flex-1">
                      <span className="font-mono text-xs text-primary">{item.item_code}</span>
                      <span className="text-xs text-foreground ml-2">{item.description}</span>
                      {si?.unit_price && <span className="text-[10px] text-primary font-mono ml-2">€{Number(si.unit_price).toFixed(2)}</span>}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </div>
                );
              })}
            </div>
            {detailLineForm.item_id && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/20 rounded-lg">
                <div><Label className="text-xs">Quantità</Label><Input type="number" step="0.01" className="font-mono h-8" value={detailLineForm.quantity} onChange={e => setDetailLineForm({ ...detailLineForm, quantity: e.target.value })} /></div>
                <div><Label className="text-xs">Prezzo €</Label><Input type="number" step="0.01" className="font-mono h-8" value={detailLineForm.unit_price} onChange={e => setDetailLineForm({ ...detailLineForm, unit_price: e.target.value })} /></div>
                <div><Label className="text-xs">Sconto %</Label><Input type="number" step="0.01" className="font-mono h-8" value={detailLineForm.discount_pct} onChange={e => setDetailLineForm({ ...detailLineForm, discount_pct: e.target.value })} /></div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddLineOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={!detailLineForm.item_id || addLineMut.isPending}>Aggiungi</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ADD DELIVERY DIALOG */}
      <Dialog open={deliveryOpen} onOpenChange={setDeliveryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Programma Consegna</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); addDeliveryMut.mutate(); }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data *</Label>
                <Input type="date" className="font-mono h-8 text-xs" value={deliveryForm.scheduled_date} onChange={e => setDeliveryForm({ ...deliveryForm, scheduled_date: e.target.value })} required />
              </div>
              <div>
                <Label className="text-xs">Quantità *</Label>
                <Input type="number" step="0.01" min="0" className="font-mono h-8 text-xs" value={deliveryForm.quantity} onChange={e => setDeliveryForm({ ...deliveryForm, quantity: e.target.value })} required />
              </div>
            </div>
            {poLines.length > 0 && (
              <div>
                <Label className="text-xs">Riga (opzionale)</Label>
                <Select value={deliveryForm.po_line_id} onValueChange={v => setDeliveryForm({ ...deliveryForm, po_line_id: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tutta l'ordine..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tutta l'ordine</SelectItem>
                    {poLines.map(line => {
                      const it = getItem(line.item_id);
                      return <SelectItem key={line.id} value={line.id}>{it?.item_code} — {line.quantity} {it?.unit_of_measure}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Stato</Label>
              <Select value={deliveryForm.status} onValueChange={v => setDeliveryForm({ ...deliveryForm, status: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[["scheduled","Programmata"],["in_transit","In Transito"],["received","Ricevuta"],["delayed","In Ritardo"]].map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Note</Label>
              <Input className="h-8 text-xs" value={deliveryForm.notes} onChange={e => setDeliveryForm({ ...deliveryForm, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDeliveryOpen(false)}>Annulla</Button>
              <Button type="submit" size="sm" disabled={!deliveryForm.scheduled_date || addDeliveryMut.isPending} className="gap-1"><Plus className="h-3 w-3" /> Salva</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} title="Importa Ordini da CSV"
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
