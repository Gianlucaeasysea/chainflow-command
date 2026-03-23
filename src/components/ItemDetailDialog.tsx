import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Plus, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface ItemDetailDialogProps {
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ItemDetailDialog({ itemId, open, onOpenChange }: ItemDetailDialogProps) {
  const qc = useQueryClient();
  const [driveUrl, setDriveUrl] = useState("");
  const [newSupplier, setNewSupplier] = useState({ supplier_id: "", unit_price: "0", lead_time_days: "14", moq: "1", supplier_item_code: "" });

  const { data: item } = useQuery({
    queryKey: ["item_detail", itemId],
    queryFn: async () => {
      if (!itemId) return null;
      const { data, error } = await supabase.from("items").select("*").eq("id", itemId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!itemId,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => { const { data, error } = await supabase.from("suppliers").select("*").order("company_name"); if (error) throw error; return data; },
  });

  const { data: supplierItems = [] } = useQuery({
    queryKey: ["supplier_items", itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const { data, error } = await supabase.from("supplier_items").select("*").eq("item_id", itemId).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!itemId,
  });

  const { data: costHistory = [] } = useQuery({
    queryKey: ["cost_history_item", itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const { data, error } = await supabase.from("cost_history").select("*").eq("item_id", itemId).order("effective_date", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!itemId,
  });

  useEffect(() => {
    if (item) setDriveUrl((item as any).drive_folder_url || "");
  }, [item]);

  const updateDriveMut = useMutation({
    mutationFn: async (url: string) => {
      const { error } = await supabase.from("items").update({ drive_folder_url: url || null } as any).eq("id", itemId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["item_detail", itemId] }); toast.success("Link Drive aggiornato"); },
  });

  const addSupplierMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("supplier_items").insert({
        item_id: itemId!, supplier_id: newSupplier.supplier_id,
        unit_price: parseFloat(newSupplier.unit_price), lead_time_days: parseInt(newSupplier.lead_time_days),
        moq: parseInt(newSupplier.moq), supplier_item_code: newSupplier.supplier_item_code || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier_items", itemId] });
      setNewSupplier({ supplier_id: "", unit_price: "0", lead_time_days: "14", moq: "1", supplier_item_code: "" });
      toast.success("Fornitore aggiunto");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteSupplierItemMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplier_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["supplier_items", itemId] }); toast.success("Rimosso"); },
  });

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.company_name || "?";

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-primary">{item.item_code}</span>
            <span className="text-foreground">{item.description}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Drive / File Link */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">File Tecnici / Cartella Drive</h3>
            <div className="flex gap-2">
              <Input placeholder="https://drive.google.com/..." className="font-mono text-sm flex-1" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} />
              <Button size="sm" variant="outline" onClick={() => updateDriveMut.mutate(driveUrl)}>Salva Link</Button>
              {driveUrl && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={driveUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              )}
            </div>
          </div>

          {/* Unit Cost + Assembly Cost */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Costi</h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Costo Unitario</Label>
                <div className="font-mono text-lg text-foreground">€{Number((item as any).unit_cost || 0).toFixed(2)}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Costo Assemblaggio</Label>
                <div className="font-mono text-lg text-foreground">€{Number((item as any).assembly_cost || 0).toFixed(2)}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Badge variant="outline" className="font-mono text-xs">{(item as any).item_type || "component"}</Badge>
              </div>
            </div>
          </div>

          {/* Supplier Items */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Fornitori Associati</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-2 text-muted-foreground text-xs font-mono">Fornitore</th>
                  <th className="text-left p-2 text-muted-foreground text-xs font-mono">Codice Forn.</th>
                  <th className="text-right p-2 text-muted-foreground text-xs font-mono">Prezzo</th>
                  <th className="text-right p-2 text-muted-foreground text-xs font-mono">Lead Time</th>
                  <th className="text-right p-2 text-muted-foreground text-xs font-mono">MOQ</th>
                  <th className="p-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {supplierItems.length === 0 ? (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">Nessun fornitore associato</td></tr>
                ) : supplierItems.map(si => (
                  <tr key={si.id} className="hover:bg-muted/20">
                    <td className="p-2 text-foreground">{getSupplierName(si.supplier_id)}</td>
                    <td className="p-2 font-mono text-xs text-muted-foreground">{si.supplier_item_code || "—"}</td>
                    <td className="p-2 text-right font-mono">€{Number(si.unit_price || 0).toFixed(2)}</td>
                    <td className="p-2 text-right font-mono text-muted-foreground">{si.lead_time_days || "—"} gg</td>
                    <td className="p-2 text-right font-mono text-muted-foreground">{si.moq || 1}</td>
                    <td className="p-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSupplierItemMut.mutate(si.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Add supplier form */}
            <div className="flex gap-2 items-end flex-wrap">
              <div className="w-48">
                <Label className="text-xs">Fornitore</Label>
                <Select value={newSupplier.supplier_id} onValueChange={(v) => setNewSupplier({ ...newSupplier, supplier_id: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label className="text-xs">Prezzo</Label>
                <Input type="number" step="0.01" className="h-8 font-mono text-xs" value={newSupplier.unit_price} onChange={(e) => setNewSupplier({ ...newSupplier, unit_price: e.target.value })} />
              </div>
              <div className="w-20">
                <Label className="text-xs">Lead Time</Label>
                <Input type="number" className="h-8 font-mono text-xs" value={newSupplier.lead_time_days} onChange={(e) => setNewSupplier({ ...newSupplier, lead_time_days: e.target.value })} />
              </div>
              <div className="w-16">
                <Label className="text-xs">MOQ</Label>
                <Input type="number" className="h-8 font-mono text-xs" value={newSupplier.moq} onChange={(e) => setNewSupplier({ ...newSupplier, moq: e.target.value })} />
              </div>
              <div className="w-28">
                <Label className="text-xs">Cod. Forn.</Label>
                <Input className="h-8 font-mono text-xs" value={newSupplier.supplier_item_code} onChange={(e) => setNewSupplier({ ...newSupplier, supplier_item_code: e.target.value })} />
              </div>
              <Button size="sm" className="h-8 gap-1" disabled={!newSupplier.supplier_id || addSupplierMut.isPending} onClick={() => addSupplierMut.mutate()}>
                <Plus className="h-3 w-3" /> Aggiungi
              </Button>
            </div>
          </div>

          {/* Cost History */}
          {costHistory.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Storico Costi</h3>
              <div className="space-y-1">
                {costHistory.map(c => (
                  <div key={c.id} className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-muted-foreground w-24">{c.effective_date}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">{c.cost_type}</Badge>
                    <span className="font-mono text-foreground">€{Number(c.amount).toFixed(2)}</span>
                    <span className="text-muted-foreground">{c.source || ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
