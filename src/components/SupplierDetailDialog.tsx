import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Star, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subMonths, startOfMonth, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";

type Supplier = {
  id: string; company_name: string; vat_number: string | null; country: string | null;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  rating: number | null; payment_terms: string | null; currency: string | null;
  incoterm: string | null; is_active: boolean; notes: string | null; address: string | null;
  contact_role: string | null;
};

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => onChange(i)}>
          <Star className={cn("h-5 w-5", i <= value ? "fill-primary text-primary" : "text-muted-foreground/30")} />
        </button>
      ))}
    </div>
  );
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn("shrink-0", i <= rating ? "fill-primary text-primary" : "text-muted-foreground/30")} style={{ width: size, height: size }} />
      ))}
    </div>
  );
}

export default function SupplierDetailDialog({
  supplier,
  open,
  onOpenChange,
}: {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const supplierId = supplier?.id;

  // Anagrafica edit state
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState(false);

  // Catalog add dialog
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogForm, setCatalogForm] = useState({ item_id: "", unit_price: "", moq: "1", lead_time_days: "", order_multiple: "1", currency: "EUR", notes: "" });
  const [editCatalogId, setEditCatalogId] = useState<string | null>(null);
  const [editCatalogForm, setEditCatalogForm] = useState<Record<string, any>>({});

  // Cert add dialog
  const [certOpen, setCertOpen] = useState(false);
  const [certForm, setCertForm] = useState({ certification_name: "", issued_date: "", expiry_date: "", document_url: "" });
  const [deleteCertId, setDeleteCertId] = useState<string | null>(null);
  const [deleteCatalogItemId, setDeleteCatalogItemId] = useState<string | null>(null);

  // --- Queries ---
  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => { const { data, error } = await supabase.from("items").select("*").order("item_code"); if (error) throw error; return data; },
  });

  const { data: supplierItems = [] } = useQuery({
    queryKey: ["supplier_items", supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data, error } = await supabase.from("supplier_items").select("*").eq("supplier_id", supplierId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supplierId,
  });

  const { data: supplierCerts = [] } = useQuery({
    queryKey: ["supplier_certifications", supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data, error } = await supabase.from("supplier_certifications").select("*").eq("supplier_id", supplierId).order("expiry_date");
      if (error) throw error;
      return data;
    },
    enabled: !!supplierId,
  });

  const { data: supplierPOs = [] } = useQuery({
    queryKey: ["supplier_pos", supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data, error } = await supabase.from("purchase_orders").select("*, po_lines(*)").eq("supplier_id", supplierId).order("order_date", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!supplierId,
  });

  // --- Mutations ---
  const updateSupplierMut = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const { error } = await supabase.from("suppliers").update(values).eq("id", supplierId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setEditing(false);
      toast.success("Anagrafica aggiornata");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addCatalogMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("supplier_items").insert({
        supplier_id: supplierId!,
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
      queryClient.invalidateQueries({ queryKey: ["supplier_items", supplierId] });
      queryClient.invalidateQueries({ queryKey: ["supplier_items"] });
      setCatalogOpen(false);
      setCatalogForm({ item_id: "", unit_price: "", moq: "1", lead_time_days: "", order_multiple: "1", currency: "EUR", notes: "" });
      toast.success("Voce listino aggiunta");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateCatalogMut = useMutation({
    mutationFn: async ({ id, ...values }: Record<string, any>) => {
      const { error } = await supabase.from("supplier_items").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier_items", supplierId] });
      queryClient.invalidateQueries({ queryKey: ["supplier_items"] });
      setEditCatalogId(null);
      toast.success("Voce aggiornata");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteCatalogMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("supplier_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier_items", supplierId] });
      queryClient.invalidateQueries({ queryKey: ["supplier_items"] });
      setDeleteCatalogItemId(null);
      toast.success("Voce rimossa");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addCertMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("supplier_certifications").insert({
        supplier_id: supplierId!,
        certification_name: certForm.certification_name,
        issued_date: certForm.issued_date || null,
        expiry_date: certForm.expiry_date || null,
        document_url: certForm.document_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier_certifications", supplierId] });
      setCertOpen(false);
      setCertForm({ certification_name: "", issued_date: "", expiry_date: "", document_url: "" });
      toast.success("Certificazione aggiunta");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteCertMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("supplier_certifications").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier_certifications", supplierId] });
      setDeleteCertId(null);
      toast.success("Certificazione rimossa");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!supplier) return null;

  const startEdit = () => {
    setEditForm({
      company_name: supplier.company_name, vat_number: supplier.vat_number || "",
      country: supplier.country || "", address: supplier.address || "",
      contact_name: supplier.contact_name || "", contact_email: supplier.contact_email || "",
      contact_phone: supplier.contact_phone || "", contact_role: supplier.contact_role || "",
      rating: supplier.rating || 0, payment_terms: supplier.payment_terms || "30gg",
      currency: supplier.currency || "EUR", incoterm: supplier.incoterm || "EXW",
      notes: supplier.notes || "",
    });
    setEditing(true);
  };

  const saveEdit = () => {
    updateSupplierMut.mutate({
      company_name: editForm.company_name,
      vat_number: editForm.vat_number || null, country: editForm.country || null,
      address: editForm.address || null, contact_name: editForm.contact_name || null,
      contact_email: editForm.contact_email || null, contact_phone: editForm.contact_phone || null,
      contact_role: editForm.contact_role || null, rating: editForm.rating || null,
      payment_terms: editForm.payment_terms || null, currency: editForm.currency || null,
      incoterm: editForm.incoterm || null, notes: editForm.notes || null,
    });
  };

  const getItemInfo = (id: string) => items.find(i => i.id === id);

  // Cert status badge
  const certStatusBadge = (expiryDate: string | null) => {
    if (!expiryDate) return <Badge variant="outline" className="text-xs">N/D</Badge>;
    const now = new Date();
    const exp = new Date(expiryDate);
    if (exp < now) return <Badge className="bg-destructive text-destructive-foreground text-[10px]">SCADUTO</Badge>;
    const daysLeft = differenceInDays(exp, now);
    if (daysLeft < 60) return <Badge className="bg-orange-500 text-white text-[10px]">&lt; 60 GG</Badge>;
    return <Badge className="bg-green-600 text-white text-[10px]">VALIDO</Badge>;
  };

  // Performance calculations
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
  const posThisYear = supplierPOs.filter(po => po.order_date && po.order_date >= yearStart.slice(0, 10));
  const deliveredPOs = supplierPOs.filter(po => po.status === "delivered" && po.actual_delivery_date && po.order_date);
  const avgLeadTime = deliveredPOs.length > 0
    ? Math.round(deliveredPOs.reduce((sum, po) => sum + differenceInDays(new Date(po.actual_delivery_date!), new Date(po.order_date!)), 0) / deliveredPOs.length)
    : 0;
  const onTimePOs = deliveredPOs.filter(po => po.actual_delivery_date && po.requested_delivery_date && po.actual_delivery_date <= po.requested_delivery_date);
  const onTimePct = deliveredPOs.length > 0 ? Math.round((onTimePOs.length / deliveredPOs.length) * 100) : 0;
  const totalValueYear = posThisYear.reduce((sum, po) => {
    const lines = (po as any).po_lines || [];
    return sum + lines.reduce((s: number, l: any) => s + (l.quantity * l.unit_price), 0);
  }, 0);
  const poCountYear = posThisYear.length;

  // Monthly chart data (last 12 months)
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = subMonths(now, 11 - i);
    const mStart = startOfMonth(m);
    const mKey = format(mStart, "yyyy-MM");
    const label = format(mStart, "MMM yy", { locale: it });
    const value = supplierPOs
      .filter(po => po.order_date && po.order_date.startsWith(mKey))
      .reduce((sum, po) => {
        const lines = (po as any).po_lines || [];
        return sum + lines.reduce((s: number, l: any) => s + (l.quantity * l.unit_price), 0);
      }, 0);
    return { label, value: Math.round(value) };
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {supplier.company_name}
              <Badge variant="outline" className={cn("text-xs ml-2", supplier.is_active ? "text-green-600 border-green-600" : "text-destructive border-destructive")}>
                {supplier.is_active ? "Attivo" : "Inattivo"}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="anagrafica">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
              <TabsTrigger value="listino">Listino ({supplierItems.length})</TabsTrigger>
              <TabsTrigger value="ordini">Ordini ({supplierPOs.length})</TabsTrigger>
              <TabsTrigger value="certs">Certificazioni ({supplierCerts.length})</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            {/* TAB 1 - Anagrafica */}
            <TabsContent value="anagrafica" className="space-y-4 mt-4">
              {!editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground text-xs block">Ragione Sociale</span><span className="font-medium">{supplier.company_name}</span></div>
                    <div><span className="text-muted-foreground text-xs block">P.IVA</span><span className="font-mono">{supplier.vat_number || "—"}</span></div>
                    <div><span className="text-muted-foreground text-xs block">Paese</span><span>{supplier.country || "—"}</span></div>
                    <div><span className="text-muted-foreground text-xs block">Indirizzo</span><span>{supplier.address || "—"}</span></div>
                    <div><span className="text-muted-foreground text-xs block">Contatto</span><span>{supplier.contact_name || "—"} {supplier.contact_role ? `(${supplier.contact_role})` : ""}</span></div>
                    <div><span className="text-muted-foreground text-xs block">Email</span><span className="font-mono">{supplier.contact_email || "—"}</span></div>
                    <div><span className="text-muted-foreground text-xs block">Telefono</span><span className="font-mono">{supplier.contact_phone || "—"}</span></div>
                    <div><span className="text-muted-foreground text-xs block">Rating</span><StarRating rating={supplier.rating || 0} /></div>
                    <div><span className="text-muted-foreground text-xs block">Valuta</span><span>{supplier.currency || "EUR"}</span></div>
                    <div><span className="text-muted-foreground text-xs block">Termini Pagamento</span><span>{supplier.payment_terms || "—"}</span></div>
                    <div><span className="text-muted-foreground text-xs block">Incoterm</span><Badge variant="outline" className="font-mono text-xs">{supplier.incoterm || "—"}</Badge></div>
                    {supplier.notes && <div className="col-span-2"><span className="text-muted-foreground text-xs block">Note</span><span>{supplier.notes}</span></div>}
                  </div>
                  <Button size="sm" onClick={startEdit} className="gap-1"><Pencil className="h-3.5 w-3.5" /> Modifica</Button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2"><Label>Ragione Sociale *</Label><Input required value={editForm.company_name} onChange={e => setEditForm({ ...editForm, company_name: e.target.value })} /></div>
                    <div><Label>P.IVA</Label><Input className="font-mono" value={editForm.vat_number} onChange={e => setEditForm({ ...editForm, vat_number: e.target.value })} /></div>
                    <div><Label>Paese</Label><Input value={editForm.country} onChange={e => setEditForm({ ...editForm, country: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Indirizzo</Label><Input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></div>
                    <div><Label>Nome Contatto</Label><Input value={editForm.contact_name} onChange={e => setEditForm({ ...editForm, contact_name: e.target.value })} /></div>
                    <div><Label>Ruolo</Label><Input value={editForm.contact_role} onChange={e => setEditForm({ ...editForm, contact_role: e.target.value })} /></div>
                    <div><Label>Email</Label><Input type="email" className="font-mono" value={editForm.contact_email} onChange={e => setEditForm({ ...editForm, contact_email: e.target.value })} /></div>
                    <div><Label>Telefono</Label><Input className="font-mono" value={editForm.contact_phone} onChange={e => setEditForm({ ...editForm, contact_phone: e.target.value })} /></div>
                    <div>
                      <Label>Valuta</Label>
                      <Select value={editForm.currency} onValueChange={v => setEditForm({ ...editForm, currency: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["EUR", "USD", "GBP", "CNY"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Termini Pagamento</Label>
                      <Select value={editForm.payment_terms} onValueChange={v => setEditForm({ ...editForm, payment_terms: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["30gg", "60gg", "90gg", "prepagato"].map(t => <SelectItem key={t} value={t}>{t === "prepagato" ? "Prepagato" : t.replace("gg", " giorni")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Incoterm</Label>
                      <Select value={editForm.incoterm} onValueChange={v => setEditForm({ ...editForm, incoterm: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["EXW", "FOB", "CIF", "DDP"].map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Rating</Label>
                      <StarRatingInput value={editForm.rating} onChange={v => setEditForm({ ...editForm, rating: v })} />
                    </div>
                    <div className="col-span-2"><Label>Note</Label><Textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={3} /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveEdit} disabled={updateSupplierMut.isPending}>{updateSupplierMut.isPending ? "Salvataggio..." : "Salva modifiche"}</Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>Annulla</Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2 - Listino Prezzi */}
            <TabsContent value="listino" className="space-y-3 mt-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setCatalogOpen(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Aggiungi</Button>
              </div>
              {supplierItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nessuna voce di listino.</p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Codice", "Descrizione", "Prezzo", "MOQ", "Lead Time", "Multiplo", "Valuta", ""].map(h => (
                          <th key={h} className="text-left p-2 text-muted-foreground text-xs uppercase font-mono">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {supplierItems.map(si => {
                        const item = getItemInfo(si.item_id);
                        const isEditing = editCatalogId === si.id;
                        if (isEditing) {
                          return (
                            <tr key={si.id} className="bg-muted/10">
                              <td className="p-2 font-mono text-primary text-xs">{item?.item_code || "?"}</td>
                              <td className="p-2 text-xs">{item?.description || ""}</td>
                              <td className="p-2"><Input type="number" step="0.01" className="h-7 w-20 font-mono text-xs" value={editCatalogForm.unit_price} onChange={e => setEditCatalogForm({ ...editCatalogForm, unit_price: e.target.value })} /></td>
                              <td className="p-2"><Input type="number" className="h-7 w-16 font-mono text-xs" value={editCatalogForm.moq} onChange={e => setEditCatalogForm({ ...editCatalogForm, moq: e.target.value })} /></td>
                              <td className="p-2"><Input type="number" className="h-7 w-16 font-mono text-xs" value={editCatalogForm.lead_time_days} onChange={e => setEditCatalogForm({ ...editCatalogForm, lead_time_days: e.target.value })} /></td>
                              <td className="p-2"><Input type="number" className="h-7 w-16 font-mono text-xs" value={editCatalogForm.order_multiple} onChange={e => setEditCatalogForm({ ...editCatalogForm, order_multiple: e.target.value })} /></td>
                              <td className="p-2 font-mono text-xs">{si.currency || "EUR"}</td>
                              <td className="p-2 flex gap-1">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateCatalogMut.mutate({
                                  id: si.id,
                                  unit_price: parseFloat(editCatalogForm.unit_price) || null,
                                  moq: parseInt(editCatalogForm.moq) || 1,
                                  lead_time_days: parseInt(editCatalogForm.lead_time_days) || null,
                                  order_multiple: parseInt(editCatalogForm.order_multiple) || 1,
                                })}><CheckCircle className="h-3.5 w-3.5 text-green-600" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditCatalogId(null)}><XCircle className="h-3.5 w-3.5" /></Button>
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={si.id} className="hover:bg-muted/20">
                            <td className="p-2 font-mono text-primary text-xs">{item?.item_code || "?"}</td>
                            <td className="p-2 text-xs text-muted-foreground">{item?.description || ""}</td>
                            <td className="p-2 font-mono text-xs">€{Number(si.unit_price || 0).toFixed(2)}</td>
                            <td className="p-2 font-mono text-xs">{si.moq || 1}</td>
                            <td className="p-2 font-mono text-xs">{si.lead_time_days ? `${si.lead_time_days}gg` : "—"}</td>
                            <td className="p-2 font-mono text-xs">{si.order_multiple || 1}</td>
                            <td className="p-2 font-mono text-xs">{si.currency || "EUR"}</td>
                            <td className="p-2 flex gap-1">
                              <button onClick={() => { setEditCatalogId(si.id); setEditCatalogForm({ unit_price: String(si.unit_price || ""), moq: String(si.moq || 1), lead_time_days: String(si.lead_time_days || ""), order_multiple: String(si.order_multiple || 1) }); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => setDeleteCatalogItemId(si.id)} className="text-destructive/40 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* TAB 3 - Ordini d'Acquisto */}
            <TabsContent value="ordini" className="mt-4">
              {supplierPOs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nessun ordine per questo fornitore.</p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Numero", "Data", "N. Righe", "Valore Totale", "Status", "Consegna"].map(h => (
                          <th key={h} className="text-left p-2 text-muted-foreground text-xs uppercase font-mono">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {supplierPOs.map(po => {
                        const lines = (po as any).po_lines || [];
                        const total = lines.reduce((s: number, l: any) => s + (l.quantity * l.unit_price), 0);
                        const isLate = po.actual_delivery_date && po.requested_delivery_date && po.actual_delivery_date > po.requested_delivery_date;
                        const isOnTime = po.actual_delivery_date && po.requested_delivery_date && po.actual_delivery_date <= po.requested_delivery_date;
                        return (
                          <tr key={po.id} className="hover:bg-muted/20">
                            <td className="p-2 font-mono text-primary text-xs">{po.po_number}</td>
                            <td className="p-2 font-mono text-xs">{po.order_date || "—"}</td>
                            <td className="p-2 font-mono text-xs text-center">{lines.length}</td>
                            <td className="p-2 font-mono text-xs">€{total.toFixed(2)}</td>
                            <td className="p-2"><Badge variant="outline" className="text-[10px] font-mono">{po.status}</Badge></td>
                            <td className="p-2">
                              {isOnTime && <CheckCircle className="h-4 w-4 text-green-600" />}
                              {isLate && <AlertTriangle className="h-4 w-4 text-destructive" />}
                              {!po.actual_delivery_date && <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* TAB 4 - Certificazioni */}
            <TabsContent value="certs" className="space-y-3 mt-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setCertOpen(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Aggiungi certificazione</Button>
              </div>
              {supplierCerts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nessuna certificazione registrata.</p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Tipo", "Emissione", "Scadenza", "Stato", "Doc", ""].map(h => (
                          <th key={h} className="text-left p-2 text-muted-foreground text-xs uppercase font-mono">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {supplierCerts.map(c => (
                        <tr key={c.id} className="hover:bg-muted/20">
                          <td className="p-2 text-sm font-medium">{c.certification_name}</td>
                          <td className="p-2 font-mono text-xs">{c.issued_date || "—"}</td>
                          <td className="p-2 font-mono text-xs">{c.expiry_date || "—"}</td>
                          <td className="p-2">{certStatusBadge(c.expiry_date)}</td>
                          <td className="p-2">{c.document_url ? <a href={c.document_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline">Apri</a> : "—"}</td>
                          <td className="p-2">
                            <button onClick={() => setDeleteCertId(c.id)} className="text-destructive/40 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* TAB 5 - Performance */}
            <TabsContent value="performance" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Lead Time Medio</p>
                  <p className="text-2xl font-bold font-mono">{avgLeadTime}<span className="text-sm text-muted-foreground ml-1">gg</span></p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Consegne Puntuali</p>
                  <p className="text-2xl font-bold font-mono">{onTimePct}<span className="text-sm text-muted-foreground ml-1">%</span></p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Valore Anno</p>
                  <p className="text-2xl font-bold font-mono">€{totalValueYear.toLocaleString("it-IT", { maximumFractionDigits: 0 })}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">PO nell'Anno</p>
                  <p className="text-2xl font-bold font-mono">{poCountYear}</p>
                </CardContent></Card>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-sm font-medium mb-3">Acquisti Mensili — Ultimi 12 Mesi</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <Tooltip formatter={(v: number) => [`€${v.toLocaleString("it-IT")}`, "Valore"]} />
                    <Line type="monotone" dataKey="value" className="stroke-primary" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Add Catalog Item Dialog */}
      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aggiungi Voce Listino</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); addCatalogMut.mutate(); }} className="space-y-4">
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

      {/* Add Cert Dialog */}
      <Dialog open={certOpen} onOpenChange={setCertOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aggiungi Certificazione</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); addCertMut.mutate(); }} className="space-y-4">
            <div><Label>Tipo Certificazione *</Label><Input required value={certForm.certification_name} onChange={e => setCertForm({ ...certForm, certification_name: e.target.value })} placeholder="es. ISO 9001" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data Emissione</Label><Input type="date" value={certForm.issued_date} onChange={e => setCertForm({ ...certForm, issued_date: e.target.value })} /></div>
              <div><Label>Data Scadenza</Label><Input type="date" value={certForm.expiry_date} onChange={e => setCertForm({ ...certForm, expiry_date: e.target.value })} /></div>
            </div>
            <div><Label>URL Documento</Label><Input value={certForm.document_url} onChange={e => setCertForm({ ...certForm, document_url: e.target.value })} placeholder="https://..." /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCertOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={!certForm.certification_name || addCertMut.isPending}>Aggiungi</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Catalog Item Confirm */}
      <AlertDialog open={!!deleteCatalogItemId} onOpenChange={() => setDeleteCatalogItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere voce listino?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione è irreversibile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteCatalogItemId && deleteCatalogMut.mutate(deleteCatalogItemId)}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Cert Confirm */}
      <AlertDialog open={!!deleteCertId} onOpenChange={() => setDeleteCertId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere certificazione?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione è irreversibile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteCertId && deleteCertMut.mutate(deleteCertId)}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
