import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Layers } from "lucide-react";
import TableSkeleton from "@/components/TableSkeleton";
import EmptyState from "@/components/EmptyState";
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
import ExportButton from "@/components/ExportButton";

const LOT_STATUSES = [
  { value: "quarantine", label: "Quarantena", color: "status-warning" },
  { value: "approved", label: "Approvato", color: "status-ok" },
  { value: "rejected", label: "Rifiutato", color: "status-critical" },
  { value: "in_use", label: "In Uso", color: "status-info" },
  { value: "exhausted", label: "Esaurito", color: "text-muted-foreground bg-muted/30" },
];

export default function LotsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    item_id: "", lot_number: "", supplier_lot_number: "", quantity_on_hand: "0",
    production_date: "", expiry_date: "", notes: "",
  });
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => { const { data, error } = await supabase.from("items").select("*").order("item_code"); if (error) throw error; return data; },
  });

  const { data: lots = [], isLoading } = useQuery({
    queryKey: ["inventory_lots"],
    queryFn: async () => { const { data, error } = await supabase.from("inventory_lots").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inventory_lots").insert({
        item_id: form.item_id, lot_number: form.lot_number,
        supplier_lot_number: form.supplier_lot_number || null,
        quantity_on_hand: parseFloat(form.quantity_on_hand),
        production_date: form.production_date || null,
        expiry_date: form.expiry_date || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory_lots"] });
      setCreateOpen(false);
      setForm({ item_id: "", lot_number: "", supplier_lot_number: "", quantity_on_hand: "0", production_date: "", expiry_date: "", notes: "" });
      toast.success("Lotto creato");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("inventory_lots").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory_lots"] }); toast.success("Stato aggiornato"); },
  });

  const filtered = lots.filter(l => {
    const matchSearch = l.lot_number.toLowerCase().includes(search.toLowerCase()) ||
      (l.supplier_lot_number || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getStatusInfo = (s: string) => LOT_STATUSES.find(st => st.value === s) || LOT_STATUSES[0];

  const getDaysToExpiry = (expiry: string | null) => {
    if (!expiry) return null;
    const diff = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Gestione Lotti</h1>
          <p className="text-sm text-muted-foreground">{lots.length} lotti tracciati</p>
        </div>
        <div className="flex gap-2">
          <ExportButton filename="lotti" columns={[
            { key: "lot_number", label: "Numero Lotto" }, { key: "item_code", label: "Codice Articolo" },
            { key: "item_desc", label: "Descrizione" }, { key: "quantity_on_hand", label: "Qtà Disponibile" },
            { key: "status", label: "Stato" }, { key: "production_date", label: "Data Produzione" },
            { key: "expiry_date", label: "Data Scadenza" },
          ]} data={lots.map(l => {
            const item = items.find(i => i.id === l.item_id);
            return { ...l, item_code: item?.item_code || "", item_desc: item?.description || "" };
          }) as any} />
          <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Nuovo Lotto</Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca lotto..." className="pl-9 font-mono text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {LOT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Lotto", "Lotto Forn.", "Articolo", "Qtà", "Stato", "Produzione", "Scadenza", "Gg Scad.", "Azioni"].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={9}><TableSkeleton rows={5} columns={7} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon={Layers} message="Nessun lotto presente in magazzino." actionLabel="Nuovo Lotto" onAction={() => setCreateOpen(true)} /></td></tr>
              ) : filtered.map(lot => {
                const si = getStatusInfo(lot.status);
                const daysToExpiry = getDaysToExpiry(lot.expiry_date);
                return (
                  <tr key={lot.id} className="hover:bg-muted/20">
                    <td className="p-3 font-mono text-primary font-medium text-xs">{lot.lot_number}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{lot.supplier_lot_number || "—"}</td>
                    <td className="p-3 font-mono text-xs">{items.find(i => i.id === lot.item_id)?.item_code || "?"}</td>
                    <td className="p-3 font-mono">{Number(lot.quantity_on_hand)}</td>
                    <td className="p-3"><Badge className={cn("text-xs", si.color)}>{si.label}</Badge></td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{lot.production_date || "—"}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{lot.expiry_date || "—"}</td>
                    <td className="p-3 font-mono text-xs">
                      {daysToExpiry !== null && (
                        <span className={cn(
                          daysToExpiry <= 0 ? "text-status-critical font-bold" :
                          daysToExpiry <= 30 ? "text-status-warning" :
                          daysToExpiry <= 90 ? "text-status-info" : "text-status-ok"
                        )}>
                          {daysToExpiry <= 0 ? `SCADUTO (${Math.abs(daysToExpiry)}gg)` : `${daysToExpiry}gg`}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <Select value={lot.status} onValueChange={(v) => updateStatusMut.mutate({ id: lot.id, status: v })}>
                        <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{LOT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuovo Lotto</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
            <div>
              <Label>Articolo *</Label>
              <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.item_code} — {i.description}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>N° Lotto Interno *</Label><Input required className="font-mono" value={form.lot_number} onChange={(e) => setForm({ ...form, lot_number: e.target.value })} /></div>
              <div><Label>N° Lotto Fornitore</Label><Input className="font-mono" value={form.supplier_lot_number} onChange={(e) => setForm({ ...form, supplier_lot_number: e.target.value })} /></div>
            </div>
            <div><Label>Quantità</Label><Input type="number" step="0.01" className="font-mono" value={form.quantity_on_hand} onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data Produzione</Label><Input type="date" className="font-mono" value={form.production_date} onChange={(e) => setForm({ ...form, production_date: e.target.value })} /></div>
              <div><Label>Data Scadenza</Label><Input type="date" className="font-mono" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
            </div>
            <div><Label>Note</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={!form.item_id || !form.lot_number || createMut.isPending}>Crea</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
