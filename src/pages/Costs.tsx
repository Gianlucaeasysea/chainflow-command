import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, TrendingUp, TrendingDown, DollarSign, RefreshCw } from "lucide-react";
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ExportButton from "@/components/ExportButton";

export default function CostsPage() {
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ item_id: "", cost_type: "standard", amount: "0", currency: "EUR", source: "", effective_date: new Date().toISOString().split("T")[0] });
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => { const { data, error } = await supabase.from("items").select("*").order("item_code"); if (error) throw error; return data; },
  });

  const { data: costHistory = [], isLoading } = useQuery({
    queryKey: ["cost_history"],
    queryFn: async () => { const { data, error } = await supabase.from("cost_history").select("*").order("effective_date", { ascending: false }); if (error) throw error; return data; },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cost_history").insert({
        item_id: form.item_id, cost_type: form.cost_type as "standard" | "actual",
        amount: parseFloat(form.amount), currency: form.currency,
        source: form.source || null, effective_date: form.effective_date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cost_history"] });
      setCreateOpen(false);
      setForm({ item_id: "", cost_type: "standard", amount: "0", currency: "EUR", source: "", effective_date: new Date().toISOString().split("T")[0] });
      toast.success("Costo registrato");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Latest cost per item
  const latestCosts = items.map(item => {
    const itemCosts = costHistory.filter(c => c.item_id === item.id);
    const latestStd = itemCosts.find(c => c.cost_type === "standard");
    const latestAct = itemCosts.find(c => c.cost_type === "actual");
    const variance = latestStd && latestAct ? ((Number(latestAct.amount) - Number(latestStd.amount)) / Number(latestStd.amount) * 100) : null;
    return { ...item, standardCost: latestStd ? Number(latestStd.amount) : null, actualCost: latestAct ? Number(latestAct.amount) : null, variance, historyCount: itemCosts.length };
  }).filter(i => i.historyCount > 0 || search);

  // Chart data for selected item
  const chartData = selectedItemId ? costHistory
    .filter(c => c.item_id === selectedItemId)
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date))
    .map(c => ({ date: c.effective_date, amount: Number(c.amount), type: c.cost_type }))
    : [];

  const filteredItems = latestCosts.filter(i =>
    i.item_code.toLowerCase().includes(search.toLowerCase()) ||
    i.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Gestione Costi</h1>
          <p className="text-sm text-muted-foreground">Storico e analisi costi articoli</p>
        </div>
        <div className="flex gap-2">
          <ExportButton filename="storico_costi" columns={[
            { key: "item_code", label: "Codice" }, { key: "item_desc", label: "Descrizione" },
            { key: "cost_type", label: "Tipo Costo" }, { key: "amount", label: "Costo Unitario" },
            { key: "effective_date", label: "Data Validità" }, { key: "source", label: "Note" },
          ]} data={costHistory.map(c => {
            const item = items.find(i => i.id === c.item_id);
            return { ...c, item_code: item?.item_code || "", item_desc: item?.description || "" };
          }) as any} />
          <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Registra Costo</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cerca articolo..." className="pl-9 font-mono text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Codice", "Descrizione", "Costo Std", "Costo Eff.", "Scostamento", ""].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nessun dato costi</td></tr>
              ) : filteredItems.map(item => (
                <tr key={item.id} className={cn("hover:bg-muted/20 cursor-pointer", selectedItemId === item.id && "bg-muted/30")} onClick={() => setSelectedItemId(item.id)}>
                  <td className="p-3 font-mono text-primary text-xs">{item.item_code}</td>
                  <td className="p-3 text-foreground text-xs">{item.description}</td>
                  <td className="p-3 font-mono">{item.standardCost !== null ? `€${item.standardCost.toFixed(2)}` : "—"}</td>
                  <td className="p-3 font-mono">{item.actualCost !== null ? `€${item.actualCost.toFixed(2)}` : "—"}</td>
                  <td className="p-3 font-mono text-xs">
                    {item.variance !== null && (
                      <span className={cn("flex items-center gap-1", item.variance > 0 ? "text-status-critical" : "text-status-ok")}>
                        {item.variance > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {item.variance > 0 ? "+" : ""}{item.variance.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{item.historyCount} voci</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Chart Panel */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Andamento Costi</h3>
          {!selectedItemId ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Seleziona un articolo</div>
          ) : chartData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Nessun dato</div>
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(213 25% 22%)" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(214 20% 55%)", fontSize: 10, fontFamily: "DM Mono" }} />
                  <YAxis tick={{ fill: "hsl(214 20% 55%)", fontSize: 10, fontFamily: "DM Mono" }} tickFormatter={(v) => `€${v}`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(213 40% 14%)", border: "1px solid hsl(213 25% 22%)", borderRadius: "6px", color: "hsl(214 33% 91%)", fontFamily: "DM Mono", fontSize: 12 }} />
                  <Line type="monotone" dataKey="amount" stroke="hsl(36 90% 55%)" strokeWidth={2} dot={{ fill: "hsl(36 90% 55%)", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registra Costo</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
            <div>
              <Label>Articolo *</Label>
              <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.item_code} — {i.description}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.cost_type} onValueChange={(v) => setForm({ ...form, cost_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="actual">Effettivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Importo</Label><Input type="number" step="0.01" className="font-mono" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" className="font-mono" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} /></div>
            </div>
            <div><Label>Fonte</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="es. Listino fornitore Q1 2024" /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={!form.item_id || createMut.isPending}>Salva</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
