import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, AlertTriangle, Boxes } from "lucide-react";
import TableSkeleton from "@/components/TableSkeleton";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ExportButton from "@/components/ExportButton";
import { POSITIVE_MOVEMENT_TYPES } from "@/lib/constants";
import { computeStockMap } from "@/lib/stock";

const MOVEMENT_TYPES = [
  { value: "po_inbound", label: "Carico da PO", sign: "+", direction: "in" },
  { value: "wo_output", label: "Scarico da WO", sign: "−", direction: "out" },
  { value: "wo_finish", label: "Carico da Produzione", sign: "+", direction: "in" },
  { value: "adjustment_in", label: "Rettifica +", sign: "+", direction: "in" },
  { value: "adjustment_out", label: "Rettifica −", sign: "−", direction: "out" },
  { value: "supplier_return", label: "Reso a Fornitore", sign: "−", direction: "out" },
  { value: "customer_return", label: "Reso da Cliente", sign: "+", direction: "in" },
  { value: "customer_shipment", label: "Spedizione Cliente", sign: "−", direction: "out" },
];

const POSITIVE_TYPES = POSITIVE_MOVEMENT_TYPES as readonly string[];

const formatEur = (v: number) =>
  v.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [movSearch, setMovSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ item_id: "", movement_type: "po_inbound", quantity: "0", lot_number: "", warehouse: "MAIN", notes: "" });
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").order("item_code");
      if (error) throw error;
      return data;
    },
  });

  const { data: movements = [], isLoading: movLoading } = useQuery({
    queryKey: ["stock_movements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: reorderParams = [] } = useQuery({
    queryKey: ["reorder_params"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reorder_params").select("item_id, reorder_point");
      if (error) throw error;
      return data;
    },
  });

  // Compute stock from movements (regole centralizzate in lib/stock)
  const stockMap = useMemo(() => computeStockMap(movements || []), [movements]);

  const ropMap = useMemo(() => new Map(reorderParams.map((r) => [r.item_id, r.reorder_point])), [reorderParams]);

  const stockLevels = useMemo(() => {
    return items
      .map((item) => {
        const stock = stockMap.get(item.id) || 0;
        const rop = ropMap.get(item.id);
        const value = stock * (item.unit_cost || 0);
        let status: "critical" | "warning" | "ok" = "ok";
        if (stock <= 0) status = "critical";
        else if (rop != null && stock <= rop) status = "warning";
        return { ...item, stock, rop, value, status };
      })
      .filter((s) => s.stock !== 0 || ropMap.has(s.id) || stockMap.has(s.id));
  }, [items, stockMap, ropMap]);

  const filteredStock = stockLevels.filter(
    (s) =>
      s.item_code.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
  );

  // Selected item stock for dialog
  const selectedItemStock = form.item_id ? stockMap.get(form.item_id) || 0 : null;
  const selectedItem = form.item_id ? items.find((i) => i.id === form.item_id) : null;
  const isOutbound = !POSITIVE_TYPES.includes(form.movement_type);
  const qtyVal = Math.abs(parseFloat(form.quantity) || 0);
  const overStock = isOutbound && selectedItemStock != null && qtyVal > selectedItemStock;

  const createMut = useMutation({
    mutationFn: async () => {
      const qty = parseFloat(form.quantity);
      const { error } = await supabase.from("stock_movements").insert({
        item_id: form.item_id,
        movement_type: form.movement_type,
        quantity: Math.abs(qty),
        lot_number: form.lot_number || null,
        warehouse: form.warehouse,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
      setCreateOpen(false);
      setForm({ item_id: "", movement_type: "po_inbound", quantity: "0", lot_number: "", warehouse: "MAIN", notes: "" });
      toast.success("Movimento registrato");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Movements filtering
  const filteredMovements = movements.filter((m) => {
    const item = items.find((i) => i.id === m.item_id);
    const matchSearch =
      (item?.item_code || "").toLowerCase().includes(movSearch.toLowerCase()) ||
      (item?.description || "").toLowerCase().includes(movSearch.toLowerCase()) ||
      (m.lot_number || "").toLowerCase().includes(movSearch.toLowerCase());
    const matchType = typeFilter === "all" || m.movement_type === typeFilter;
    const mDate = m.created_at.slice(0, 10);
    const matchFrom = !dateFrom || mDate >= dateFrom;
    const matchTo = !dateTo || mDate <= dateTo;
    return matchSearch && matchType && matchFrom && matchTo;
  });

  const statusBadge = (status: "critical" | "warning" | "ok") => {
    const map = {
      critical: { label: "CRITICO", cls: "bg-status-critical/20 text-status-critical border-status-critical/30" },
      warning: { label: "SOTTO ROP", cls: "bg-status-warning/20 text-status-warning border-status-warning/30" },
      ok: { label: "OK", cls: "bg-status-ok/20 text-status-ok border-status-ok/30" },
    };
    const s = map[status];
    return <Badge variant="outline" className={cn("text-[10px] font-mono", s.cls)}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Gestione Magazzino</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} articoli — Stock totale: {formatEur(stockLevels.reduce((s, i) => s + i.value, 0))}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton filename="movimenti_magazzino" columns={[
            { key: "created_at", label: "Data" }, { key: "item_code", label: "Codice Articolo" },
            { key: "item_desc", label: "Descrizione" }, { key: "movement_type", label: "Tipo Movimento" },
            { key: "quantity", label: "Quantità" }, { key: "lot_number", label: "Lotto" },
            { key: "notes", label: "Note" },
          ]} data={movements.map(m => {
            const item = items.find(i => i.id === m.item_id);
            return { ...m, item_code: item?.item_code || "", item_desc: item?.description || "" };
          }) as any} />
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nuovo Movimento
          </Button>
        </div>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Livelli di Stock</TabsTrigger>
          <TabsTrigger value="movements">Movimenti ({movements.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca articolo..." className="pl-9 font-mono text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Codice", "Descrizione", "Stock", "UdM", "ROP", "Stato", "Valore"].map((h) => (
                      <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movLoading ? (
                    <tr><td colSpan={7} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
                  ) : filteredStock.length === 0 ? (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nessun dato</td></tr>
                  ) : (
                    filteredStock.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/20">
                        <td className="p-3 font-mono text-primary text-xs">{s.item_code}</td>
                        <td className="p-3 text-foreground text-xs max-w-[200px] truncate">{s.description}</td>
                        <td className="p-3 font-mono font-medium">
                          <span className={cn(s.status === "critical" ? "text-status-critical" : s.status === "warning" ? "text-status-warning" : "text-status-ok")}>
                            {s.stock.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-3"><Badge variant="outline" className="font-mono text-xs">{s.unit_of_measure}</Badge></td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{s.rop != null ? s.rop : "—"}</td>
                        <td className="p-3">{statusBadge(s.status)}</td>
                        <td className="p-3 font-mono text-xs">{formatEur(s.value)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cerca articolo o lotto..." className="pl-9 font-mono text-sm" value={movSearch} onChange={(e) => setMovSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                {MOVEMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" className="w-40 font-mono text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="Da" />
            <Input type="date" className="w-40 font-mono text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="A" />
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Data", "Articolo", "Tipo", "Quantità", "Lotto", "Note"].map((h) => (
                      <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movLoading ? (
                    <tr><td colSpan={6}><TableSkeleton rows={5} columns={5} /></td></tr>
                  ) : filteredMovements.length === 0 ? (
                    <tr><td colSpan={6}><EmptyState icon={Boxes} message="Nessun movimento registrato." actionLabel="Nuovo Movimento" onAction={() => setCreateOpen(true)} /></td></tr>
                  ) : (
                    filteredMovements.slice(0, 100).map((m) => {
                      const mt = MOVEMENT_TYPES.find((t) => t.value === m.movement_type);
                      const qty = Number(m.quantity);
                      const isIn = qty >= 0;
                      return (
                        <tr key={m.id} className={cn("hover:bg-muted/20", isIn ? "bg-status-ok/5" : "bg-status-critical/5")}>
                          <td className="p-3 font-mono text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("it-IT")}</td>
                          <td className="p-3 font-mono text-primary text-xs">{items.find((i) => i.id === m.item_id)?.item_code || "?"}</td>
                          <td className="p-3"><Badge variant="outline" className="text-xs">{mt?.label || m.movement_type}</Badge></td>
                          <td className="p-3 font-mono font-medium">
                            <span className={cn(isIn ? "text-status-ok" : "text-status-critical")}>{isIn ? "+" : ""}{qty}</span>
                          </td>
                          <td className="p-3 font-mono text-xs text-muted-foreground">{m.lot_number || "—"}</td>
                          <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{m.notes || "—"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Nuovo Movimento */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registra Movimento</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
            <div>
              <Label>Articolo *</Label>
              <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.item_code} — {i.description}</SelectItem>)}</SelectContent>
              </Select>
              {selectedItem && selectedItemStock != null && (
                <p className="text-xs text-muted-foreground mt-1">
                  Stock attuale: <span className="font-mono font-medium">{selectedItemStock.toFixed(2)} {selectedItem.unit_of_measure}</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo Movimento *</Label>
                <Select value={form.movement_type} onValueChange={(v) => setForm({ ...form, movement_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MOVEMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.sign} {t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantità *</Label>
                <Input type="number" step="0.01" min="0" className="font-mono" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
            </div>
            {overStock && (
              <div className="flex items-center gap-2 text-status-warning text-xs bg-status-warning/10 p-2 rounded">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Attenzione: quantità superiore allo stock disponibile ({selectedItemStock?.toFixed(2)})
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Lotto</Label><Input className="font-mono" value={form.lot_number} onChange={(e) => setForm({ ...form, lot_number: e.target.value })} /></div>
              <div><Label>Magazzino</Label><Input value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} /></div>
            </div>
            <div><Label>Note</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={!form.item_id || createMut.isPending}>Registra</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
