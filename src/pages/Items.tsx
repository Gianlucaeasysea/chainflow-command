import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Upload, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import CsvImportDialog from "@/components/CsvImportDialog";
import ItemDetailDialog from "@/components/ItemDetailDialog";
import ExportButton from "@/components/ExportButton";

const CATEGORIES = ["Materia Prima", "Componente", "Semilavorato", "Prodotto Finito", "Imballaggio", "Consumabile"];
const UOM_OPTIONS = ["PZ", "KG", "M", "L", "M2", "M3", "SET", "ROL"];
const ITEM_TYPES = [
  { value: "component", label: "Componente" },
  { value: "raw_material", label: "Materia Prima" },
  { value: "finished_product", label: "Prodotto Finito" },
  { value: "assembly", label: "Lavorazione / Assemblaggio" },
  { value: "packaging", label: "Imballaggio" },
];

const emptyItem = {
  item_code: "", description: "", unit_of_measure: "PZ", category: "", notes: "",
  item_type: "component", unit_cost: "0", assembly_cost: "0",
};

export default function ItemsPage() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyItem);
  const [csvOpen, setCsvOpen] = useState(false);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").order("item_code");
      if (error) throw error;
      return data;
    },
  });

  const upsertMut = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      const payload: any = {
        item_code: values.item_code, description: values.description,
        unit_of_measure: values.unit_of_measure, category: values.category || null,
        notes: values.notes || null, item_type: values.item_type || "component",
        unit_cost: parseFloat(values.unit_cost) || 0,
        assembly_cost: parseFloat(values.assembly_cost) || 0,
      };
      if (values.id) {
        const { error } = await supabase.from("items").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      setDialogOpen(false); setEditItem(null); setForm(emptyItem);
      toast.success(editItem ? "Articolo aggiornato" : "Articolo creato");
    },
    onError: (e) => toast.error("Errore: " + (e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["items"] }); setDeleteId(null); toast.success("Articolo eliminato"); },
    onError: (e) => toast.error("Errore: " + (e as Error).message),
  });

  const handleCsvImport = async (rows: Record<string, string>[]) => {
    const payload = rows.map(r => ({
      item_code: r["codice"] || r["item_code"] || r["Codice"] || "",
      description: r["descrizione"] || r["description"] || r["Descrizione"] || "",
      unit_of_measure: r["udm"] || r["unit_of_measure"] || r["UdM"] || "PZ",
      category: r["categoria"] || r["category"] || r["Categoria"] || null,
      notes: r["note"] || r["notes"] || r["Note"] || null,
      item_type: r["tipo"] || r["item_type"] || r["Tipo"] || "component",
      unit_cost: parseFloat(r["costo"] || r["unit_cost"] || r["Costo"] || "0") || 0,
      assembly_cost: parseFloat(r["costo_assemblaggio"] || r["assembly_cost"] || "0") || 0,
    })).filter(r => r.item_code);
    const { error } = await supabase.from("items").insert(payload as any);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["items"] });
  };

  const filtered = items.filter((i: any) => {
    const matchSearch = i.item_code.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || i.category === catFilter;
    return matchSearch && matchCat;
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({
      item_code: item.item_code, description: item.description,
      unit_of_measure: item.unit_of_measure, category: item.category || "",
      notes: item.notes || "", item_type: item.item_type || "component",
      unit_cost: String(item.unit_cost || 0), assembly_cost: String(item.assembly_cost || 0),
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Anagrafica Articoli</h1>
          <p className="text-sm text-muted-foreground">{items.length} articoli registrati</p>
        </div>
        <div className="flex gap-2">
          <ExportButton filename="articoli" columns={[
            { key: "item_code", label: "Codice" }, { key: "description", label: "Descrizione" },
            { key: "category", label: "Categoria" }, { key: "unit_of_measure", label: "UdM" },
            { key: "item_type", label: "Tipo" }, { key: "unit_cost", label: "Costo Unitario" },
            { key: "assembly_cost", label: "Costo Assemblaggio" }, { key: "notes", label: "Note" },
          ]} data={items as any} />
          <Button variant="outline" onClick={() => setCsvOpen(true)} className="gap-2"><Upload className="h-4 w-4" /> Importa CSV</Button>
          <Button onClick={() => { setEditItem(null); setForm(emptyItem); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Nuovo Articolo
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca codice o descrizione..." className="pl-9 font-mono text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Codice", "Descrizione", "Tipo", "UdM", "Costo Unit.", "Costo Ass.", "Categoria", ""].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Caricamento...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">{search || catFilter !== "all" ? "Nessun risultato" : "Nessun articolo — crea il primo"}</td></tr>
              ) : filtered.map((item: any) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setDetailItemId(item.id)}>
                  <td className="p-3 font-mono text-primary font-medium">{item.item_code}</td>
                  <td className="p-3 text-foreground">{item.description}</td>
                  <td className="p-3"><Badge variant="outline" className="text-[10px] font-mono">{ITEM_TYPES.find(t => t.value === (item.item_type || "component"))?.label || item.item_type}</Badge></td>
                  <td className="p-3"><Badge variant="outline" className="font-mono text-xs">{item.unit_of_measure}</Badge></td>
                  <td className="p-3 font-mono text-sm">€{Number(item.unit_cost || 0).toFixed(2)}</td>
                  <td className="p-3 font-mono text-sm text-muted-foreground">{Number(item.assembly_cost || 0) > 0 ? `€${Number(item.assembly_cost).toFixed(2)}` : "—"}</td>
                  <td className="p-3 text-muted-foreground text-xs">{item.category || "—"}</td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailItemId(item.id)}><Eye className="h-3.5 w-3.5 mr-2" /> Dettaglio</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5 mr-2" /> Modifica</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Elimina</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editItem ? "Modifica Articolo" : "Nuovo Articolo"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsertMut.mutate({ ...form, id: editItem?.id }); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Codice Articolo *</Label>
                <Input required className="font-mono" value={form.item_code} onChange={(e) => setForm({ ...form, item_code: e.target.value })} />
              </div>
              <div>
                <Label>Tipo Articolo</Label>
                <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Descrizione *</Label>
                <Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label>Unità di Misura</Label>
                <Select value={form.unit_of_measure} onValueChange={(v) => setForm({ ...form, unit_of_measure: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Costo Unitario (€)</Label>
                <Input type="number" step="0.01" className="font-mono" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
              </div>
              <div>
                <Label>Costo Assemblaggio (€)</Label>
                <Input type="number" step="0.01" className="font-mono" value={form.assembly_cost} onChange={(e) => setForm({ ...form, assembly_cost: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Note</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={upsertMut.isPending}>{upsertMut.isPending ? "Salvataggio..." : "Salva"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>Eliminare questo articolo? L'azione è irreversibile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && deleteMut.mutate(deleteId)}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import */}
      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} title="Importa Articoli da CSV"
        expectedColumns={["codice", "descrizione", "udm", "categoria", "tipo", "costo", "costo_assemblaggio", "note"]}
        onImport={handleCsvImport} />

      {/* Item Detail */}
      <ItemDetailDialog itemId={detailItemId} open={!!detailItemId} onOpenChange={() => setDetailItemId(null)} />
    </div>
  );
}
