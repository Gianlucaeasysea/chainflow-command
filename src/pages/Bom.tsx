import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ChevronRight, ChevronDown, Layers, Trash2 } from "lucide-react";
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

export default function BomPage() {
  const [selectedBom, setSelectedBom] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [newBom, setNewBom] = useState({ item_id: "", notes: "" });
  const [newLine, setNewLine] = useState({ component_item_id: "", quantity: "1", waste_pct: "0", notes: "" });
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
      setCreateOpen(false);
      setNewBom({ item_id: "", notes: "" });
      toast.success("Distinta base creata");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addLineMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bom_lines").insert({
        bom_header_id: selectedBom!,
        component_item_id: newLine.component_item_id,
        quantity: parseFloat(newLine.quantity),
        waste_pct: parseFloat(newLine.waste_pct),
        notes: newLine.notes || null,
        sort_order: bomLines.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bom_lines", selectedBom] });
      setAddLineOpen(false);
      setNewLine({ component_item_id: "", quantity: "1", waste_pct: "0", notes: "" });
      toast.success("Componente aggiunto");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteLineMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bom_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bom_lines", selectedBom] });
      toast.success("Componente rimosso");
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("bom_headers").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bom_headers"] });
      toast.success("Stato aggiornato");
    },
  });

  const getItemName = (id: string) => {
    const item = items.find(i => i.id === id);
    return item ? `${item.item_code} — ${item.description}` : id;
  };
  const getItemCode = (id: string) => items.find(i => i.id === id)?.item_code || "?";

  const selectedHeader = bomHeaders.find(b => b.id === selectedBom);

  const statusColors: Record<string, string> = {
    draft: "status-warning",
    active: "status-ok",
    obsolete: "status-critical",
  };

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
              <button
                key={bom.id}
                onClick={() => setSelectedBom(bom.id)}
                className={cn(
                  "w-full text-left p-3 hover:bg-muted/30 transition-colors flex items-center gap-3",
                  selectedBom === bom.id && "bg-muted/50 border-l-2 border-l-primary"
                )}
              >
                <Layers className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{getItemCode(bom.item_id)}</div>
                  <div className="text-xs text-muted-foreground">v{bom.version}</div>
                </div>
                <Badge className={cn("text-xs shrink-0", statusColors[bom.status])}>{bom.status}</Badge>
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
                    <Button size="sm" variant="outline" onClick={() => updateStatusMut.mutate({ id: selectedHeader.id, status: "active" })}>
                      Attiva
                    </Button>
                  )}
                  {selectedHeader.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatusMut.mutate({ id: selectedHeader.id, status: "obsolete" })}>
                      Obsoleta
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setAddLineOpen(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Componente</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Componente</th>
                      <th className="text-right p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Qtà</th>
                      <th className="text-right p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Scarto %</th>
                      <th className="text-right p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Qtà Effettiva</th>
                      <th className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Note</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bomLines.length === 0 ? (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nessun componente</td></tr>
                    ) : bomLines.map(line => {
                      const effectiveQty = Number(line.quantity) * (1 + Number(line.waste_pct) / 100);
                      return (
                        <tr key={line.id} className="hover:bg-muted/20">
                          <td className="p-3">
                            <span className="font-mono text-primary text-xs">{getItemCode(line.component_item_id)}</span>
                            <span className="text-foreground/70 text-xs ml-2">{items.find(i => i.id === line.component_item_id)?.description || ""}</span>
                          </td>
                          <td className="p-3 text-right font-mono">{Number(line.quantity)}</td>
                          <td className="p-3 text-right font-mono text-muted-foreground">{Number(line.waste_pct)}%</td>
                          <td className="p-3 text-right font-mono text-primary">{effectiveQty.toFixed(4)}</td>
                          <td className="p-3 text-muted-foreground text-xs">{line.notes || "—"}</td>
                          <td className="p-3">
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
                <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.item_code} — {i.description}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note</Label>
              <Input value={newBom.notes} onChange={(e) => setNewBom({ ...newBom, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={!newBom.item_id || createBomMut.isPending}>Crea</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Line Dialog */}
      <Dialog open={addLineOpen} onOpenChange={setAddLineOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aggiungi Componente</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addLineMut.mutate(); }} className="space-y-4">
            <div>
              <Label>Componente *</Label>
              <Select value={newLine.component_item_id} onValueChange={(v) => setNewLine({ ...newLine, component_item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona articolo..." /></SelectTrigger>
                <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.item_code} — {i.description}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantità</Label>
                <Input type="number" step="0.0001" className="font-mono" value={newLine.quantity} onChange={(e) => setNewLine({ ...newLine, quantity: e.target.value })} />
              </div>
              <div>
                <Label>Scarto %</Label>
                <Input type="number" step="0.01" className="font-mono" value={newLine.waste_pct} onChange={(e) => setNewLine({ ...newLine, waste_pct: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Input value={newLine.notes} onChange={(e) => setNewLine({ ...newLine, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddLineOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={!newLine.component_item_id || addLineMut.isPending}>Aggiungi</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
