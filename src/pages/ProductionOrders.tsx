import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Factory } from "lucide-react";
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

const WO_STATUSES = [
  { value: "planned", label: "Pianificato", color: "text-muted-foreground bg-muted/50" },
  { value: "materials_allocated", label: "Materiali Allocati", color: "status-info" },
  { value: "in_progress", label: "In Lavorazione", color: "status-warning" },
  { value: "quality_check", label: "Controllo Qualità", color: "status-info" },
  { value: "completed", label: "Completato", color: "status-ok" },
  { value: "closed", label: "Chiuso", color: "text-muted-foreground bg-muted/30" },
];

const PRIORITIES = [
  { value: "low", label: "Bassa", color: "text-muted-foreground" },
  { value: "normal", label: "Normale", color: "text-foreground" },
  { value: "high", label: "Alta", color: "text-status-warning" },
  { value: "urgent", label: "Urgente", color: "text-status-critical" },
];

export default function ProductionOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    product_item_id: "", bom_header_id: "", quantity_to_produce: "1",
    priority: "normal", planned_start: "", planned_end: "", notes: "",
  });
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

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "in_progress") updates.actual_start = new Date().toISOString().split("T")[0];
      if (status === "completed") updates.actual_end = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("production_orders").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["production_orders"] }); toast.success("Stato aggiornato"); },
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
              <div><Label>Quantità *</Label><Input type="number" step="0.01" className="font-mono" value={form.quantity_to_produce} onChange={(e) => setForm({ ...form, quantity_to_produce: e.target.value })} /></div>
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
    </div>
  );
}
