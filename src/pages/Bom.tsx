import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Layers, Trash2, Eye, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import ItemDetailDialog from "@/components/ItemDetailDialog";

export default function BomPage() {
  const [selectedBom, setSelectedBom] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [newBom, setNewBom] = useState({ item_id: "", notes: "" });
  const [selectedComponents, setSelectedComponents] = useState<Record<string, { quantity: string; waste_pct: string; notes: string }>>({});
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").order("item_code");
      if (error) throw error;
      return data;
    },
  });

  const { data: bomHeaders = [] } = useQuery({
    queryKey: ["bom_headers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bom_headers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Load latest standard cost from cost_history for all BOM parent items
  const { data: costHistory = [] } = useQuery({
    queryKey: ["cost_history_standard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cost_history").select("*").eq("cost_type", "standard").order("effective_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: bomLines = [] } = useQuery({
    queryKey: ["bom_lines", selectedBom],
    queryFn: async () => {
      if (!selectedBom) return [];
      const { data, error } = await supabase.from("bom_lines").select("*").eq("bom_header_id", selectedBom).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBom,
  });

  const createBomMut = useMutation({
    mutationFn: async () => {
      const existingVersions = bomHeaders.filter(b => b.item_id === newBom.item_id);
      const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions.map(b => b.version)) + 1 : 1;
      const { error } = await supabase.from("bom_headers").insert({
        item_id: newBom.item_id, version: nextVersion, status: "draft", notes: newBom.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bom_headers"] });
      setCreateOpen(false); setNewBom({ item_id: "", notes: "" });
      toast.success("Distinta base creata");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addLineMut = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(selectedComponents);
      if (entries.length === 0) throw new Error("Seleziona almeno un componente");
      const rows = entries.map(([itemId, vals], idx) => ({
        bom_header_id: selectedBom!,
        component_item_id: itemId,
        quantity: parseFloat(vals.quantity) || 1,
        waste_pct: parseFloat(vals.waste_pct) || 0,
        notes: vals.notes || null,
        sort_order: bomLines.length + idx,
      }));
      const { error } = await supabase.from("bom_lines").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bom_lines", selectedBom] });
      setAddLineOpen(false);
      setSelectedComponents({});
      toast.success("Componenti aggiunti");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteLineMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("bom_lines").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bom_lines", selectedBom] }); toast.success("Componente rimosso"); },
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("bom_headers").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bom_headers"] }); toast.success("Stato aggiornato"); },
  });

  const updateStandardCostMut = useMutation({
    mutationFn: async ({ itemId, cost, version }: { itemId: string; cost: number; version: number }) => {
      const { error: histErr } = await supabase.from("cost_history").insert({
        item_id: itemId,
        cost_type: "standard",
        amount: cost,
        effective_date: new Date().toISOString().slice(0, 10),
        source: `Aggiornato da BOM v${version}`,
      });
      if (histErr) throw histErr;
      const { error: itemErr } = await supabase.from("items").update({ unit_cost: cost }).eq("id", itemId);
      if (itemErr) throw itemErr;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["cost_history_standard"] });
      toast.success(`Costo standard aggiornato: €${vars.cost.toFixed(2)}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const getItem = (id: string) => items.find((i: any) => i.id === id);
  const getItemName = (id: string) => { const item = getItem(id); return item ? `${item.item_code} — ${item.description}` : id; };
  const getItemCode = (id: string) => getItem(id)?.item_code || "?";

  // Check if a BOM's cost is outdated vs last standard cost_history
  const getLatestStandardCost = (itemId: string) => {
    const record = costHistory.find(c => c.item_id === itemId);
    return record ? Number(record.amount) : null;
  };

  const isCostOutdated = (bom: typeof bomHeaders[0]) => {
    // We need to compute BOM cost for this header — only meaningful for selected BOM
    // For list view, compare item.unit_cost with a quick flag
    const lastStd = getLatestStandardCost(bom.item_id);
    if (lastStd === null) return true; // never set
    const item = getItem(bom.item_id) as any;
    const itemCost = Number(item?.unit_cost || 0);
    return Math.abs(lastStd - itemCost) > 0.01 || lastStd === 0;
  };

  const selectedHeader = bomHeaders.find(b => b.id === selectedBom);

  // Calculate total BOM cost
  const bomTotalCost = bomLines.reduce((sum, line) => {
    const item = getItem(line.component_item_id) as any;
    const unitCost = Number(item?.unit_cost || 0) + Number(item?.assembly_cost || 0);
    const effectiveQty = Number(line.quantity) * (1 + Number(line.waste_pct) / 100);
    return sum + unitCost * effectiveQty;
  }, 0);

  // Parent item assembly cost
  const parentItem = selectedHeader ? getItem(selectedHeader.item_id) as any : null;
  const parentAssemblyCost = Number(parentItem?.assembly_cost || 0);
  const totalProductCost = bomTotalCost + parentAssemblyCost;

  const statusColors: Record<string, string> = { draft: "status-warning", active: "status-ok", obsolete: "status-critical" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Distinte Base (BOM)</h1>
          <p className="text-sm text-muted-foreground">{bomHeaders.length} distinte registrate</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Nuova Distinta</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* BOM List */}
        <div className="bg-card border border-border rounded-lg">
          <div className="p-3 border-b border-border">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Distinte Base</span>
          </div>
          <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {bomHeaders.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Nessuna distinta</div>
            ) : bomHeaders.map(bom => (
              <button key={bom.id} onClick={() => setSelectedBom(bom.id)}
                className={cn("w-full text-left p-3 hover:bg-muted/30 transition-colors flex items-center gap-3",
                  selectedBom === bom.id && "bg-muted/50 border-l-2 border-l-primary")}>
                <Layers className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{getItemCode(bom.item_id)}</div>
                  <div className="text-xs text-muted-foreground">v{bom.version}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {bom.status === "active" && isCostOutdated(bom) && (
                    <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-500 gap-0.5">
                      <AlertTriangle className="h-3 w-3" /> Costo
                    </Badge>
                  )}
                  <Badge className={cn("text-xs", statusColors[bom.status])}>{bom.status}</Badge>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* BOM Detail */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg">
          {!selectedHeader ? (
            <div className="p-12 text-center text-muted-foreground">Seleziona una distinta base</div>
          ) : (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{getItemName(selectedHeader.item_id)}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-muted-foreground">Versione {selectedHeader.version}</span>
                    <Badge className={cn("text-xs", statusColors[selectedHeader.status])}>{selectedHeader.status}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedHeader.status === "draft" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatusMut.mutate({ id: selectedHeader.id, status: "active" })}>Attiva</Button>
                  )}
                  {selectedHeader.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatusMut.mutate({ id: selectedHeader.id, status: "obsolete" })}>Obsoleta</Button>
                  )}
                  <Button size="sm" onClick={() => setAddLineOpen(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Componente</Button>
                </div>
              </div>

              {/* Cost Summary */}
              <div className="p-4 border-b border-border bg-muted/20 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Costo Componenti</div>
                  <div className="text-lg font-mono text-foreground">€{bomTotalCost.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Costo Assemblaggio</div>
                  <div className="text-lg font-mono text-foreground">€{parentAssemblyCost.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Costo Totale Prodotto</div>
                  <div className="text-lg font-mono text-primary font-bold">€{totalProductCost.toFixed(2)}</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Componente</th>
                      <th className="text-right p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Qtà x1</th>
                      <th className="text-right p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Scarto %</th>
                      <th className="text-right p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Qtà Effettiva</th>
                      <th className="text-right p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Costo Unit.</th>
                      <th className="text-right p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Costo Riga</th>
                      <th className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Note</th>
                      <th className="p-3 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bomLines.length === 0 ? (
                      <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nessun componente — aggiungi il primo</td></tr>
                    ) : bomLines.map(line => {
                      const compItem = getItem(line.component_item_id) as any;
                      const effectiveQty = Number(line.quantity) * (1 + Number(line.waste_pct) / 100);
                      const unitCost = Number(compItem?.unit_cost || 0) + Number(compItem?.assembly_cost || 0);
                      const lineCost = unitCost * effectiveQty;
                      return (
                        <tr key={line.id} className="hover:bg-muted/20">
                          <td className="p-3">
                            <button onClick={() => setDetailItemId(line.component_item_id)} className="text-left hover:underline">
                              <span className="font-mono text-primary text-xs">{getItemCode(line.component_item_id)}</span>
                              <span className="text-foreground/70 text-xs ml-2">{compItem?.description || ""}</span>
                            </button>
                          </td>
                          <td className="p-3 text-right font-mono">{Number(line.quantity)}</td>
                          <td className="p-3 text-right font-mono text-muted-foreground">{Number(line.waste_pct)}%</td>
                          <td className="p-3 text-right font-mono text-primary">{effectiveQty.toFixed(4)}</td>
                          <td className="p-3 text-right font-mono text-muted-foreground">€{unitCost.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono text-foreground font-medium">€{lineCost.toFixed(2)}</td>
                          <td className="p-3 text-muted-foreground text-xs">{line.notes || "—"}</td>
                          <td className="p-3 flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailItemId(line.component_item_id)}>
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteLineMut.mutate(line.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create BOM Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuova Distinta Base</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createBomMut.mutate(); }} className="space-y-4">
            <div>
              <Label>Prodotto Padre *</Label>
              <Select value={newBom.item_id} onValueChange={(v) => setNewBom({ ...newBom, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona articolo..." /></SelectTrigger>
                <SelectContent>{items.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.item_code} — {i.description}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Note</Label><Input value={newBom.notes} onChange={(e) => setNewBom({ ...newBom, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={!newBom.item_id || createBomMut.isPending}>Crea</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Lines Dialog — Multi-select */}
      <Dialog open={addLineOpen} onOpenChange={(open) => { setAddLineOpen(open); if (!open) { setSelectedComponents({}); setSearchTerm(""); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>Aggiungi Componenti alla Distinta</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca articolo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <div className="flex-1 overflow-y-auto border border-border rounded-lg divide-y divide-border max-h-[40vh]">
            {items.filter((i: any) => {
              const term = searchTerm.toLowerCase();
              return !term || i.item_code.toLowerCase().includes(term) || i.description.toLowerCase().includes(term);
            }).map((item: any) => {
              const isSelected = !!selectedComponents[item.id];
              return (
                <div key={item.id} className={cn("flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors", isSelected && "bg-muted/50")}>
                  <Checkbox checked={isSelected} onCheckedChange={(checked) => {
                    setSelectedComponents(prev => {
                      if (checked) return { ...prev, [item.id]: { quantity: "1", waste_pct: "0", notes: "" } };
                      const next = { ...prev }; delete next[item.id]; return next;
                    });
                  }} />
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-primary text-xs">{item.item_code}</span>
                    <span className="text-foreground/70 text-xs ml-2">{item.description}</span>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.0001" placeholder="Qtà" className="w-20 h-7 text-xs font-mono"
                        value={selectedComponents[item.id].quantity}
                        onChange={(e) => setSelectedComponents(prev => ({ ...prev, [item.id]: { ...prev[item.id], quantity: e.target.value } }))} />
                      <Input type="number" step="0.01" placeholder="Scarto%" className="w-20 h-7 text-xs font-mono"
                        value={selectedComponents[item.id].waste_pct}
                        onChange={(e) => setSelectedComponents(prev => ({ ...prev, [item.id]: { ...prev[item.id], waste_pct: e.target.value } }))} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {Object.keys(selectedComponents).length > 0 && (
            <div className="text-xs text-muted-foreground">{Object.keys(selectedComponents).length} componenti selezionati</div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setAddLineOpen(false); setSelectedComponents({}); setSearchTerm(""); }}>Annulla</Button>
            <Button onClick={() => addLineMut.mutate()} disabled={Object.keys(selectedComponents).length === 0 || addLineMut.isPending}>
              Aggiungi {Object.keys(selectedComponents).length > 0 ? `(${Object.keys(selectedComponents).length})` : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Detail */}
      <ItemDetailDialog itemId={detailItemId} open={!!detailItemId} onOpenChange={() => setDetailItemId(null)} />
    </div>
  );
}
