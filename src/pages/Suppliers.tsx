import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Star, MoreHorizontal, Pencil, Trash2, Upload, Eye, X } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CsvImportDialog from "@/components/CsvImportDialog";
import ExportButton from "@/components/ExportButton";

type Supplier = {
  id: string; company_name: string; vat_number: string | null; country: string | null;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  rating: number | null; payment_terms: string | null; currency: string | null;
  incoterm: string | null; is_active: boolean; notes: string | null; address: string | null;
  contact_role: string | null;
};

const emptySupplier = {
  company_name: "", vat_number: "", country: "", address: "",
  contact_name: "", contact_email: "", contact_phone: "", contact_role: "",
  rating: 0, payment_terms: "30gg", currency: "EUR", incoterm: "EXW", notes: "",
};

const emptyCatalogItem = {
  item_id: "", unit_price: "", moq: "1", lead_time_days: "", order_multiple: "1", currency: "EUR", notes: "",
};

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("shrink-0", i <= rating ? "fill-primary text-primary" : "text-muted-foreground/30")} style={{ width: size, height: size }} />
      ))}
    </div>
  );
}

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptySupplier);
  const [csvOpen, setCsvOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [catalogForm, setCatalogForm] = useState(emptyCatalogItem);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("company_name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => { const { data, error } = await supabase.from("items").select("*").order("item_code"); if (error) throw error; return data; },
  });

  const { data: supplierItems = [] } = useQuery({
    queryKey: ["supplier_items", detailId],
    queryFn: async () => {
      if (!detailId) return [];
      const { data, error } = await supabase.from("supplier_items").select("*").eq("supplier_id", detailId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!detailId,
  });

  const { data: supplierCerts = [] } = useQuery({
    queryKey: ["supplier_certifications", detailId],
    queryFn: async () => {
      if (!detailId) return [];
      const { data, error } = await supabase.from("supplier_certifications").select("*").eq("supplier_id", detailId).order("expiry_date");
      if (error) throw error;
      return data;
    },
    enabled: !!detailId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      const payload = {
        company_name: values.company_name, vat_number: values.vat_number || null,
        country: values.country || null, address: values.address || null,
        contact_name: values.contact_name || null, contact_email: values.contact_email || null,
        contact_phone: values.contact_phone || null, contact_role: values.contact_role || null,
        rating: values.rating || null, payment_terms: values.payment_terms || null,
        currency: values.currency || null, incoterm: values.incoterm || null, notes: values.notes || null,
      };
      if (values.id) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDialogOpen(false); setEditSupplier(null); setForm(emptySupplier);
      toast.success(editSupplier ? "Fornitore aggiornato" : "Fornitore creato");
    },
    onError: (err) => toast.error("Errore: " + (err as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("suppliers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["suppliers"] }); setDeleteId(null); toast.success("Fornitore eliminato"); },
    onError: (err) => toast.error("Errore: " + (err as Error).message),
  });

  const addCatalogMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("supplier_items").insert({
        supplier_id: detailId!,
        item_id: catalogForm.item_id,
        unit_price: parseFloat(catalogForm.unit_price) || null,
        moq: parseInt(catalogForm.moq) || 1,
        lead_time_days: parseInt(catalogForm.lead_time_days) || null,
        order_multiple: parseInt(catalogForm.order_multiple) || 1,
        currency: catalogForm.currency,
        notes: catalogForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier_items", detailId] });
      queryClient.invalidateQueries({ queryKey: ["supplier_items"] });
      setCatalogOpen(false); setCatalogForm(emptyCatalogItem);
      toast.success("Voce listino aggiunta");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteCatalogMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("supplier_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier_items", detailId] });
      queryClient.invalidateQueries({ queryKey: ["supplier_items"] });
      toast.success("Voce listino rimossa");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const filtered = suppliers.filter(
    (s) => s.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.country || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.vat_number || "").toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (s: Supplier) => {
    setEditSupplier(s);
    setForm({
      company_name: s.company_name, vat_number: s.vat_number || "", country: s.country || "",
      address: s.address || "", contact_name: s.contact_name || "", contact_email: s.contact_email || "",
      contact_phone: s.contact_phone || "", contact_role: s.contact_role || "",
      rating: s.rating || 0, payment_terms: s.payment_terms || "30gg",
      currency: s.currency || "EUR", incoterm: s.incoterm || "EXW", notes: s.notes || "",
    });
    setDialogOpen(true);
  };

  const openNew = () => { setEditSupplier(null); setForm(emptySupplier); setDialogOpen(true); };

  const selectedSupplier = suppliers.find(s => s.id === detailId);
  const getItemInfo = (id: string) => items.find(i => i.id === id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Anagrafica Fornitori</h1>
          <p className="text-sm text-muted-foreground">{suppliers.length} fornitori registrati</p>
        </div>
        <div className="flex gap-2">
          <ExportButton filename="fornitori" columns={[
            { key: "company_name", label: "Ragione Sociale" }, { key: "vat_number", label: "P.IVA" },
            { key: "country", label: "Paese" }, { key: "contact_name", label: "Contatto" },
            { key: "contact_email", label: "Email" }, { key: "contact_phone", label: "Telefono" },
            { key: "payment_terms", label: "Termini Pagamento" }, { key: "incoterm", label: "Incoterm" },
            { key: "rating", label: "Rating" },
          ]} data={suppliers as any} />
          <Button variant="outline" onClick={() => setCsvOpen(true)} className="gap-2"><Upload className="h-4 w-4" /> Importa CSV</Button>
          <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nuovo Fornitore</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cerca per nome, paese, P.IVA..." className="pl-9 font-mono text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Ragione Sociale", "Paese", "Contatto", "Rating", "Termini", "Incoterm", "Stato", ""].map(h => (
                  <th key={h} className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Caricamento...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">{search ? "Nessun risultato" : "Nessun fornitore — crea il primo"}</td></tr>
              ) : filtered.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setDetailId(s.id)}>
                  <td className="p-3 font-medium text-foreground">{s.company_name}</td>
                  <td className="p-3 text-muted-foreground">{s.country || "—"}</td>
                  <td className="p-3">
                    <div className="text-foreground/80 text-xs">{s.contact_name || "—"}</div>
                    <div className="text-muted-foreground text-xs font-mono">{s.contact_email || ""}</div>
                  </td>
                  <td className="p-3"><StarRating rating={s.rating || 0} /></td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{s.payment_terms || "—"}</td>
                  <td className="p-3"><Badge variant="outline" className="font-mono text-xs">{s.incoterm || "—"}</Badge></td>
                  <td className="p-3"><Badge className={cn("text-xs", s.is_active ? "status-ok" : "status-critical")}>{s.is_active ? "Attivo" : "Inattivo"}</Badge></td>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5 mr-2" /> Modifica</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Elimina</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== SUPPLIER DETAIL PANEL ===== */}
      <Dialog open={!!detailId} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSupplier?.company_name || "Fornitore"}</DialogTitle>
          </DialogHeader>
          {selectedSupplier && (
            <Tabs defaultValue="info">
              <TabsList>
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="catalog">Listino Prezzi ({supplierItems.length})</TabsTrigger>
                <TabsTrigger value="certs">Certificazioni ({supplierCerts.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground text-xs">Paese:</span> <span className="ml-1">{selectedSupplier.country || "—"}</span></div>
                  <div><span className="text-muted-foreground text-xs">P.IVA:</span> <span className="ml-1 font-mono">{selectedSupplier.vat_number || "—"}</span></div>
                  <div><span className="text-muted-foreground text-xs">Contatto:</span> <span className="ml-1">{selectedSupplier.contact_name || "—"} {selectedSupplier.contact_role ? `(${selectedSupplier.contact_role})` : ""}</span></div>
                  <div><span className="text-muted-foreground text-xs">Email:</span> <span className="ml-1 font-mono">{selectedSupplier.contact_email || "—"}</span></div>
                  <div><span className="text-muted-foreground text-xs">Telefono:</span> <span className="ml-1 font-mono">{selectedSupplier.contact_phone || "—"}</span></div>
                  <div><span className="text-muted-foreground text-xs">Rating:</span> <span className="ml-1"><StarRating rating={selectedSupplier.rating || 0} /></span></div>
                  <div><span className="text-muted-foreground text-xs">Pagamento:</span> <span className="ml-1">{selectedSupplier.payment_terms || "—"}</span></div>
                  <div><span className="text-muted-foreground text-xs">Incoterm:</span> <span className="ml-1">{selectedSupplier.incoterm || "—"}</span></div>
                  {selectedSupplier.address && <div className="col-span-2"><span className="text-muted-foreground text-xs">Indirizzo:</span> <span className="ml-1">{selectedSupplier.address}</span></div>}
                  {selectedSupplier.notes && <div className="col-span-2"><span className="text-muted-foreground text-xs">Note:</span> <span className="ml-1">{selectedSupplier.notes}</span></div>}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => { openEdit(selectedSupplier); setDetailId(null); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Modifica
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="catalog" className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setCatalogOpen(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Aggiungi voce</Button>
                </div>
                {supplierItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nessuna voce di listino — aggiungi articoli con prezzi e lead time.</p>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {["Articolo", "Prezzo", "MOQ", "Lead Time", "Multiplo", "Valuta", ""].map(h => (
                            <th key={h} className="text-left p-2 text-muted-foreground text-xs uppercase font-mono">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {supplierItems.map(si => {
                          const item = getItemInfo(si.item_id);
                          return (
                            <tr key={si.id} className="hover:bg-muted/20">
                              <td className="p-2">
                                <span className="font-mono text-primary text-xs">{item?.item_code || "?"}</span>
                                <span className="text-xs text-muted-foreground ml-1">{item?.description || ""}</span>
                              </td>
                              <td className="p-2 font-mono text-xs">€{Number(si.unit_price || 0).toFixed(2)}</td>
                              <td className="p-2 font-mono text-xs">{si.moq || 1}</td>
                              <td className="p-2 font-mono text-xs">{si.lead_time_days ? `${si.lead_time_days}gg` : "—"}</td>
                              <td className="p-2 font-mono text-xs">{si.order_multiple || 1}</td>
                              <td className="p-2 font-mono text-xs">{si.currency || "EUR"}</td>
                              <td className="p-2">
                                <button onClick={() => deleteCatalogMut.mutate(si.id)} className="text-destructive/40 hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="certs" className="space-y-3">
                {supplierCerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nessuna certificazione registrata.</p>
                ) : (
                  <div className="space-y-2">
                    {supplierCerts.map(c => (
                      <div key={c.id} className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.certification_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.issued_date ? `Emesso: ${c.issued_date}` : ""} {c.expiry_date ? `— Scadenza: ${c.expiry_date}` : ""}
                          </p>
                        </div>
                        {c.expiry_date && new Date(c.expiry_date) < new Date(Date.now() + 60 * 86400000) && (
                          <Badge variant="outline" className="text-status-warning text-[10px]">In scadenza</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Catalog Item Dialog */}
      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aggiungi Voce Listino</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addCatalogMut.mutate(); }} className="space-y-4">
            <div>
              <Label>Articolo *</Label>
              <Select value={catalogForm.item_id} onValueChange={v => setCatalogForm({ ...catalogForm, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona articolo..." /></SelectTrigger>
                <SelectContent>
                  {items.filter(i => !supplierItems.some(si => si.item_id === i.id)).map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.item_code} — {i.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prezzo Unitario</Label><Input type="number" step="0.01" className="font-mono" value={catalogForm.unit_price} onChange={e => setCatalogForm({ ...catalogForm, unit_price: e.target.value })} /></div>
              <div><Label>MOQ</Label><Input type="number" min="1" className="font-mono" value={catalogForm.moq} onChange={e => setCatalogForm({ ...catalogForm, moq: e.target.value })} /></div>
              <div><Label>Lead Time (giorni)</Label><Input type="number" min="0" className="font-mono" value={catalogForm.lead_time_days} onChange={e => setCatalogForm({ ...catalogForm, lead_time_days: e.target.value })} /></div>
              <div><Label>Multiplo d'Ordine</Label><Input type="number" min="1" className="font-mono" value={catalogForm.order_multiple} onChange={e => setCatalogForm({ ...catalogForm, order_multiple: e.target.value })} /></div>
              <div>
                <Label>Valuta</Label>
                <Select value={catalogForm.currency} onValueChange={v => setCatalogForm({ ...catalogForm, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["EUR", "USD", "GBP", "CNY"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Note</Label><Textarea value={catalogForm.notes} onChange={e => setCatalogForm({ ...catalogForm, notes: e.target.value })} rows={2} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCatalogOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={!catalogForm.item_id || addCatalogMut.isPending}>Aggiungi</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Supplier Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editSupplier ? "Modifica Fornitore" : "Nuovo Fornitore"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsertMutation.mutate({ ...form, id: editSupplier?.id }); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Ragione Sociale *</Label><Input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
              <div><Label>P.IVA</Label><Input className="font-mono" value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} /></div>
              <div><Label>Paese</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              <div className="col-span-2"><Label>Indirizzo</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Nome Contatto</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div><Label>Ruolo</Label><Input value={form.contact_role} onChange={(e) => setForm({ ...form, contact_role: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" className="font-mono" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
              <div><Label>Telefono</Label><Input className="font-mono" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
              <div>
                <Label>Valuta</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["EUR", "USD", "GBP", "CNY"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Termini Pagamento</Label>
                <Select value={form.payment_terms} onValueChange={(v) => setForm({ ...form, payment_terms: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["30gg", "60gg", "90gg", "prepagato"].map(t => <SelectItem key={t} value={t}>{t === "prepagato" ? "Prepagato" : t.replace("gg", " giorni")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Incoterm</Label>
                <Select value={form.incoterm} onValueChange={(v) => setForm({ ...form, incoterm: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["EXW", "FOB", "CIF", "DDP"].map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rating (1-5)</Label>
                <Input type="number" min={0} max={5} step={0.5} value={form.rating} onChange={(e) => setForm({ ...form, rating: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="col-span-2"><Label>Note</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={upsertMutation.isPending}>{upsertMutation.isPending ? "Salvataggio..." : "Salva"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>Sei sicuro di voler eliminare questo fornitore? L'azione è irreversibile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} title="Importa Fornitori da CSV"
        expectedColumns={["ragione_sociale", "partita_iva", "paese", "indirizzo", "contatto_nome", "contatto_email", "contatto_telefono"]}
        onImport={async (rows) => {
          const payload = rows.map(r => ({
            company_name: r["ragione_sociale"] || r["company_name"] || "",
            vat_number: r["partita_iva"] || r["vat_number"] || null,
            country: r["paese"] || r["country"] || null,
            address: r["indirizzo"] || r["address"] || null,
            contact_name: r["contatto_nome"] || r["contact_name"] || null,
            contact_email: r["contatto_email"] || r["contact_email"] || null,
            contact_phone: r["contatto_telefono"] || r["contact_phone"] || null,
          })).filter(r => r.company_name);
          const { error } = await supabase.from("suppliers").insert(payload);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ["suppliers"] });
        }} />
    </div>
  );
}
