import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Star, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Supplier = {
  id: string;
  company_name: string;
  vat_number: string | null;
  country: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  rating: number | null;
  payment_terms: string | null;
  currency: string | null;
  incoterm: string | null;
  is_active: boolean;
  notes: string | null;
  address: string | null;
  contact_role: string | null;
};

const emptySupplier = {
  company_name: "",
  vat_number: "",
  country: "",
  address: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  contact_role: "",
  rating: 0,
  payment_terms: "30gg",
  currency: "EUR",
  incoterm: "EXW",
  notes: "",
};

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "shrink-0",
            i <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"
          )}
          style={{ width: size, height: size }}
        />
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
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("company_name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      const payload = {
        company_name: values.company_name,
        vat_number: values.vat_number || null,
        country: values.country || null,
        address: values.address || null,
        contact_name: values.contact_name || null,
        contact_email: values.contact_email || null,
        contact_phone: values.contact_phone || null,
        contact_role: values.contact_role || null,
        rating: values.rating || null,
        payment_terms: values.payment_terms || null,
        currency: values.currency || null,
        incoterm: values.incoterm || null,
        notes: values.notes || null,
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
      setDialogOpen(false);
      setEditSupplier(null);
      setForm(emptySupplier);
      toast.success(editSupplier ? "Fornitore aggiornato" : "Fornitore creato");
    },
    onError: (err) => toast.error("Errore: " + (err as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDeleteId(null);
      toast.success("Fornitore eliminato");
    },
    onError: (err) => toast.error("Errore: " + (err as Error).message),
  });

  const filtered = suppliers.filter(
    (s) =>
      s.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.country || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.vat_number || "").toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (s: Supplier) => {
    setEditSupplier(s);
    setForm({
      company_name: s.company_name,
      vat_number: s.vat_number || "",
      country: s.country || "",
      address: s.address || "",
      contact_name: s.contact_name || "",
      contact_email: s.contact_email || "",
      contact_phone: s.contact_phone || "",
      contact_role: s.contact_role || "",
      rating: s.rating || 0,
      payment_terms: s.payment_terms || "30gg",
      currency: s.currency || "EUR",
      incoterm: s.incoterm || "EXW",
      notes: s.notes || "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditSupplier(null);
    setForm(emptySupplier);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Anagrafica Fornitori</h1>
          <p className="text-sm text-muted-foreground">
            {suppliers.length} fornitori registrati
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nuovo Fornitore
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per nome, paese, P.IVA..."
          className="pl-9 font-mono text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Ragione Sociale</th>
                <th className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Paese</th>
                <th className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Contatto</th>
                <th className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Rating</th>
                <th className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Termini</th>
                <th className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Incoterm</th>
                <th className="text-left p-3 text-muted-foreground text-xs uppercase tracking-wider font-mono font-medium">Stato</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Caricamento...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    {search ? "Nessun risultato" : "Nessun fornitore — crea il primo"}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium text-foreground">{s.company_name}</td>
                    <td className="p-3 text-muted-foreground">{s.country || "—"}</td>
                    <td className="p-3">
                      <div className="text-foreground/80 text-xs">{s.contact_name || "—"}</div>
                      <div className="text-muted-foreground text-xs font-mono">{s.contact_email || ""}</div>
                    </td>
                    <td className="p-3">
                      <StarRating rating={s.rating || 0} />
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{s.payment_terms || "—"}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="font-mono text-xs">
                        {s.incoterm || "—"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge className={cn("text-xs", s.is_active ? "status-ok" : "status-critical")}>
                        {s.is_active ? "Attivo" : "Inattivo"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(s)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Modifica
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(s.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Elimina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editSupplier ? "Modifica Fornitore" : "Nuovo Fornitore"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              upsertMutation.mutate({ ...form, id: editSupplier?.id });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Ragione Sociale *</Label>
                <Input
                  required
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                />
              </div>
              <div>
                <Label>P.IVA</Label>
                <Input
                  className="font-mono"
                  value={form.vat_number}
                  onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Paese</Label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Indirizzo</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div>
                <Label>Nome Contatto</Label>
                <Input
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Ruolo</Label>
                <Input
                  value={form.contact_role}
                  onChange={(e) => setForm({ ...form, contact_role: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  className="font-mono"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                />
              </div>
              <div>
                <Label>Telefono</Label>
                <Input
                  className="font-mono"
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Valuta</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Termini Pagamento</Label>
                <Select value={form.payment_terms} onValueChange={(v) => setForm({ ...form, payment_terms: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30gg">30 giorni</SelectItem>
                    <SelectItem value="60gg">60 giorni</SelectItem>
                    <SelectItem value="90gg">90 giorni</SelectItem>
                    <SelectItem value="prepagato">Prepagato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Incoterm</Label>
                <Select value={form.incoterm} onValueChange={(v) => setForm({ ...form, incoterm: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXW">EXW</SelectItem>
                    <SelectItem value="FOB">FOB</SelectItem>
                    <SelectItem value="CIF">CIF</SelectItem>
                    <SelectItem value="DDP">DDP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rating (1-5)</Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.5}
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-2">
                <Label>Note</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo fornitore? L'azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
