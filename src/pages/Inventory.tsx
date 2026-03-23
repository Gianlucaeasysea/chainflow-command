import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, ArrowUpDown } from "lucide-react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MOVEMENT_TYPES = [
  { value: "inbound_po", label: "Carico da PO", sign: "+" },
  { value: "outbound_wo", label: "Scarico da WO", sign: "−" },
  { value: "adjustment", label: "Rettifica", sign: "±" },
  { value: "return_supplier", label: "Reso a Fornitore", sign: "−" },
  { value: "return_customer", label: "Reso da Cliente", sign: "+" },
  { value: "transfer", label: "Trasferimento", sign: "↔" },
];

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ item_id: "", movement_type: "inbound_po", quantity: "0", lot_number: "", warehouse: "MAIN", notes: "" });
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => { const { data, error } = await supabase.from("items").select("*").order("item_code"); if (error) throw error; return data; },
  });

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["stock_movements"],
    queryFn: async () => { const { data, error } = await supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(200); if (error) throw error; return data; },
  });

  // Compute stock levels from movements
  const stockLevels = items.map(item => {
    const itemMovements = movements.filter(m => m.item_id === item.id);
    const totalIn = itemMovements.filter(m => ["inbound_po", "return_customer", "adjustment"].includes(m.movement_type) && Number(m.quantity) > 0).reduce((s, m) => s + Number(m.quantity), 0);
    const totalOut = itemMovements.filter(m => ["outbound_wo", "return_supplier"].includes(m.movement_type)).reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);
    const adjustNeg = itemMovements.filter(m => m.movement_type === "adjustment" && Number(m.quantity) < 0).reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);
    return { ...item, stock: totalIn - totalOut - adjustNeg, movementCount: itemMovements.length };
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const qty = parseFloat(form.quantity);
      const { error } = await supabase.from("stock_movements").insert({
        item_id: form.item_id, movement_type: form.movement_type,
        quantity: ["outbound_wo", "return_supplier"].includes(form.movement_type) ? -Math.abs(qty) : qty,
        lot_number: form.lot_number || null, warehouse: form.warehouse, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
      setCreateOpen(false);
      setForm({ item_id: "", movement_type: "inbound_po", quantity: "0", lot_number: "", warehouse: "MAIN", notes: "" });
      toast.success("Movimento registrato");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const filtered = movements.filter(m => {
    const item = items.find(i => i.id === m.item_id);
    const matchSearch = (item?.item_code || "").toLowerCase().includes(search.toLowerCase()) || (m.lot_number || "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || m.movement_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Gestione Magazzino</h1>
          <p className="text-sm text-muted-foreground">{items.length} articoli — {movements.length} movimenti</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Nuovo Movimento</Button>
      </div>

      {/* Stock Levels Summary */}
      <div className="bg-card border border-border rounded-lg">
        <div className="p-3 border-b border-border">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Livelli di Stock</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Codice", "Descrizione", "UdM", "Giacenza", "Movimenti"].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stockLevels.filter(s => s.movementCount > 0 || s.stock !== 0).length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nessun movimento registrato</td></tr>
              ) : stockLevels.filter(s => s.movementCount > 0 || s.stock !== 0).map(s => (
                <tr key={s.id} className="hover:bg-muted/20">
                  <td className="p-3 font-mono text-primary text-xs">{s.item_code}</td>
                  <td className="p-3 text-foreground text-xs">{s.description}</td>
                  <td className="p-3"><Badge variant="outline" className="font-mono text-xs">{s.unit_of_measure}</Badge></td>
                  <td className="p-3 font-mono font-medium">
                    <span className={cn(s.stock <= 0 ? "text-status-critical" : s.stock < 10 ? "text-status-warning" : "text-status-ok")}>
                      {s.stock.toFixed(2)}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{s.movementCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Movements */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca per codice o lotto..." className="pl-9 font-mono text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {MOVEMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Data", "Articolo", "Tipo", "Quantità", "Lotto", "Magazzino", "Note"].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Caricamento...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nessun movimento</td></tr>
              ) : filtered.slice(0, 50).map(m => {
                const mt = MOVEMENT_TYPES.find(t => t.value === m.movement_type);
                const qty = Number(m.quantity);
                return (
                  <tr key={m.id} className="hover:bg-muted/20">
                    <td className="p-3 font-mono text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("it-IT")}</td>
                    <td className="p-3 font-mono text-primary text-xs">{items.find(i => i.id === m.item_id)?.item_code || "?"}</td>
                    <td className="p-3"><Badge variant="outline" className="text-xs">{mt?.label || m.movement_type}</Badge></td>
                    <td className="p-3 font-mono font-medium">
                      <span className={cn(qty >= 0 ? "text-status-ok" : "text-status-critical")}>{qty >= 0 ? "+" : ""}{qty}</span>
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{m.lot_number || "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{m.warehouse}</td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[150px] truncate">{m.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registra Movimento</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
            <div>
              <Label>Articolo *</Label>
              <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.item_code} — {i.description}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo Movimento *</Label>
                <Select value={form.movement_type} onValueChange={(v) => setForm({ ...form, movement_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MOVEMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.sign} {t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Quantità *</Label><Input type="number" step="0.01" className="font-mono" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            </div>
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
