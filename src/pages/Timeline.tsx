import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ChevronLeft, ChevronRight, Factory, Truck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------- helpers ----------

const MONTHS_SHORT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
function daysInYear(y: number) {
  return isLeapYear(y) ? 366 : 365;
}
function dayOfYear(d: Date): number {
  return Math.ceil((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
}
function dateToPct(dateStr: string, year: number): number | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const dy = d.getFullYear();
  if (dy < year) return 0;
  if (dy > year) return 100;
  return ((dayOfYear(d) - 1) / daysInYear(year)) * 100;
}
function monthBoundaries(year: number) {
  return MONTHS_SHORT.map((label, i) => {
    const d = new Date(year, i, 1);
    return { label, pct: ((dayOfYear(d) - 1) / daysInYear(year)) * 100 };
  });
}

// ---------- constants ----------

const PO_STATUS_COLORS: Record<string, string> = {
  draft:         "bg-muted-foreground/30 border-muted-foreground/20",
  sent:          "bg-blue-500/40 border-blue-500/30",
  confirmed:     "bg-emerald-500/40 border-emerald-500/30",
  pre_series:    "bg-purple-500/40 border-purple-500/30",
  in_production: "bg-amber-500/40 border-amber-500/30",
  shipping:      "bg-cyan-500/40 border-cyan-500/30",
  customs:       "bg-orange-500/40 border-orange-500/30",
  delivered:     "bg-emerald-400/50 border-emerald-400/30",
  closed:        "bg-muted-foreground/20 border-muted-foreground/10",
  cancelled:     "bg-red-500/30 border-red-500/20",
};

const PO_STATUS_LABELS: Record<string, string> = {
  draft: "Bozza", sent: "Inviato", confirmed: "Confermato",
  pre_series: "Pre-Serie", in_production: "In Produzione",
  shipping: "In Spedizione", customs: "In Dogana",
  delivered: "Consegnato", closed: "Chiuso", cancelled: "Annullato",
};

const DELIVERY_DOT: Record<string, string> = {
  scheduled:  "bg-blue-400 border-blue-300",
  in_transit: "bg-amber-400 border-amber-300",
  received:   "bg-emerald-400 border-emerald-300",
  delayed:    "bg-red-400 border-red-300",
};

const DELIVERY_LABELS: Record<string, string> = {
  scheduled:  "Programmata",
  in_transit: "In Transito",
  received:   "Ricevuta",
  delayed:    "In Ritardo",
};

// ---------- types ----------

type Item         = { id: string; item_code: string; description: string; category: string | null; item_type: string | null };
type PO           = { id: string; po_number: string; supplier_id: string; status: string; order_date: string | null; requested_delivery_date: string | null; actual_delivery_date: string | null };
type PoLine       = { id: string; purchase_order_id: string; item_id: string; quantity: number; unit_of_measure?: string };
type PoDelivery   = { id: string; purchase_order_id: string; po_line_id: string | null; scheduled_date: string; quantity: number; status: string; notes: string | null };
type WO           = { id: string; wo_number: string; product_item_id: string; quantity_to_produce: number; status: string; planned_start: string | null; planned_end: string | null; actual_start: string | null; actual_end: string | null };

// ---------- component ----------

export default function TimelinePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [showWO, setShowWO] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [form, setForm] = useState({ scheduled_date: "", quantity: "0", status: "scheduled", notes: "", po_line_id: "" });
  const qc = useQueryClient();

  const { data: items = [] }   = useQuery<Item[]>({ queryKey: ["items"],   queryFn: async () => { const { data, error } = await supabase.from("items").select("id,item_code,description,category,item_type").order("item_code"); if (error) throw error; return data as Item[]; } });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: async () => { const { data, error } = await supabase.from("suppliers").select("id,company_name"); if (error) throw error; return data; } });
  const { data: orders = [] }  = useQuery<PO[]>({ queryKey: ["purchase_orders"], queryFn: async () => { const { data, error } = await supabase.from("purchase_orders").select("id,po_number,supplier_id,status,order_date,requested_delivery_date,actual_delivery_date"); if (error) throw error; return data as PO[]; } });
  const { data: poLines = [] } = useQuery<PoLine[]>({ queryKey: ["all_po_lines"], queryFn: async () => { const { data, error } = await supabase.from("po_lines").select("id,purchase_order_id,item_id,quantity"); if (error) throw error; return data as PoLine[]; } });
  const { data: deliveries = [] } = useQuery<PoDelivery[]>({ queryKey: ["po_deliveries"], queryFn: async () => { const { data, error } = await (supabase.from as any)("po_deliveries").select("*").order("scheduled_date"); if (error) { console.warn("po_deliveries not available yet:", error.message); return []; } return data as PoDelivery[]; } });
  const { data: wos = [] }     = useQuery<WO[]>({ queryKey: ["production_orders"], queryFn: async () => { const { data, error } = await supabase.from("production_orders").select("id,wo_number,product_item_id,quantity_to_produce,status,planned_start,planned_end,actual_start,actual_end"); if (error) throw error; return data as WO[]; } });

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from as any)("po_deliveries").insert({
        purchase_order_id: selectedPoId!,
        po_line_id: form.po_line_id || null,
        scheduled_date: form.scheduled_date,
        quantity: parseFloat(form.quantity),
        status: form.status,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["po_deliveries"] }); setAddOpen(false); setForm({ scheduled_date: "", quantity: "0", status: "scheduled", notes: "", po_line_id: "" }); toast.success("Consegna programmata"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase.from as any)("po_deliveries").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["po_deliveries"] }); toast.success("Consegna rimossa"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const months = useMemo(() => monthBoundaries(year), [year]);
  const todayPct = useMemo(() => {
    const t = new Date();
    return t.getFullYear() === year ? ((dayOfYear(t) - 1) / daysInYear(year)) * 100 : null;
  }, [year]);

  // Build gantt rows: for each item, collect POs that contain it + WOs for it
  const ganttRows = useMemo(() => {
    type PoEntry = {
      po: PO;
      supplierName: string;
      linesForItem: PoLine[];
      allPoDeliveries: PoDelivery[];
      barStart: number | null;
      barEnd: number | null;
    };
    type WoEntry = { wo: WO; barStart: number | null; barEnd: number | null };
    type Row = { item: Item; poEntries: PoEntry[]; woEntries: WoEntry[] };

    const map = new Map<string, Row>();

    // PO lines → item grouping
    poLines.forEach(line => {
      const po = orders.find(o => o.id === line.purchase_order_id);
      if (!po || po.status === "cancelled") return;
      const item = items.find(i => i.id === line.item_id);
      if (!item) return;

      const startDate = po.order_date;
      const endDate   = po.actual_delivery_date || po.requested_delivery_date;

      // POs fully before or after the year → skip (unless they have deliveries in year)
      const poDeliveriesThisYear = deliveries.filter(d =>
        d.purchase_order_id === po.id &&
        new Date(d.scheduled_date).getFullYear() === year
      );
      const startYear = startDate ? new Date(startDate).getFullYear() : null;
      const endYear   = endDate   ? new Date(endDate).getFullYear()   : null;
      const inRange   =
        poDeliveriesThisYear.length > 0 ||
        (startYear !== null && startYear <= year && (endYear === null || endYear >= year)) ||
        (startYear === null && endYear !== null && endYear >= year);
      if (!inRange) return;

      if (!map.has(item.id)) map.set(item.id, { item, poEntries: [], woEntries: [] });
      const row = map.get(item.id)!;

      // Deduplicate PO per item row
      if (row.poEntries.some(e => e.po.id === po.id)) return;

      const supplier = (suppliers as any[]).find((s: any) => s.id === po.supplier_id);
      row.poEntries.push({
        po,
        supplierName: supplier?.company_name || "—",
        linesForItem: poLines.filter(l => l.purchase_order_id === po.id && l.item_id === item.id),
        allPoDeliveries: deliveries.filter(d => d.purchase_order_id === po.id),
        barStart: startDate ? dateToPct(startDate, year) : null,
        barEnd:   endDate   ? dateToPct(endDate,   year) : null,
      });
    });

    // Production orders → item grouping
    if (showWO) {
      wos.forEach(wo => {
        if (wo.status === "closed") return;
        const item = items.find(i => i.id === wo.product_item_id);
        if (!item) return;

        const startDate = wo.actual_start || wo.planned_start;
        const endDate   = wo.actual_end   || wo.planned_end;
        if (!startDate && !endDate) return;

        const startYear = startDate ? new Date(startDate).getFullYear() : null;
        const endYear   = endDate   ? new Date(endDate).getFullYear()   : null;
        if (startYear !== null && startYear > year) return;
        if (endYear   !== null && endYear   < year) return;

        if (!map.has(item.id)) map.set(item.id, { item, poEntries: [], woEntries: [] });
        const row = map.get(item.id)!;
        row.woEntries.push({
          wo,
          barStart: startDate ? dateToPct(startDate, year) : null,
          barEnd:   endDate   ? dateToPct(endDate,   year) : null,
        });
      });
    }

    return Array.from(map.values()).sort((a, b) =>
      a.item.item_code.localeCompare(b.item.item_code)
    );
  }, [items, orders, poLines, deliveries, wos, suppliers, year, showWO]);

  const selectedPoLines = useMemo(
    () => poLines.filter(l => l.purchase_order_id === selectedPoId),
    [selectedPoId, poLines]
  );

  // Grid line + today marker shared fragment
  const GridLines = () => (
    <>
      {months.map(m => (
        <div key={m.pct} className="absolute inset-y-0 w-px bg-border/20" style={{ left: `${m.pct}%` }} />
      ))}
      {todayPct !== null && (
        <div className="absolute inset-y-0 w-0.5 bg-primary/40 z-20" style={{ left: `${todayPct}%` }} />
      )}
    </>
  );

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Timeline Forniture</h1>
          <p className="text-sm text-muted-foreground">Vista Gantt ordini, consegne programmate e produzione</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="show-wo" checked={showWO} onCheckedChange={setShowWO} />
            <Label htmlFor="show-wo" className="text-sm cursor-pointer flex items-center gap-1.5">
              <Factory className="h-3.5 w-3.5" /> Ordini Produzione
            </Label>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setYear(y => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono text-sm px-3 py-1 bg-muted/30 rounded border border-border min-w-[56px] text-center">{year}</span>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setYear(y => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
        {[
          { color: "bg-emerald-500/40 border-emerald-500/30", label: "PO Confermato" },
          { color: "bg-amber-500/40 border-amber-500/30",    label: "In Produzione" },
          { color: "bg-cyan-500/40 border-cyan-500/30",      label: "In Spedizione" },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={cn("w-5 h-3 rounded border inline-block", l.color)} />
            {l.label}
          </span>
        ))}
        {showWO && (
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-3 rounded border bg-violet-500/40 border-violet-500/30 inline-block" />
            Ordine Produzione
          </span>
        )}
        {Object.entries(DELIVERY_LABELS).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={cn("w-2.5 h-2.5 rounded-full border inline-block", DELIVERY_DOT[key])} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-0.5 h-3.5 bg-primary/60 inline-block" />
          Oggi
        </span>
      </div>

      {/* ── Gantt ── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Column headers */}
        <div className="flex border-b border-border bg-muted/30">
          <div className="w-52 shrink-0 border-r border-border flex items-center px-3 py-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Articolo / Ordine</span>
          </div>
          <div className="flex-1 relative h-8 overflow-hidden">
            {months.map(({ label, pct }) => (
              <div key={label} className="absolute top-0 bottom-0" style={{ left: `${pct}%` }}>
                <div className="absolute inset-y-0 w-px bg-border/40" />
                <span className="absolute top-1.5 left-1 text-[10px] font-mono text-muted-foreground select-none">{label}</span>
              </div>
            ))}
            {todayPct !== null && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-primary/50 z-10" style={{ left: `${todayPct}%` }}>
                <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] text-primary font-mono">▼</span>
              </div>
            )}
          </div>
        </div>

        {/* Rows */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 300px)" }}>
          {ganttRows.length === 0 ? (
            <div className="p-14 text-center text-muted-foreground text-sm">
              Nessun ordine nel {year}.<br />
              <span className="text-xs">Crea ordini fornitori con date per vederli qui.</span>
            </div>
          ) : ganttRows.map(({ item, poEntries, woEntries }) => (
            <div key={item.id} className="border-b border-border/40">
              {/* Item header row */}
              <div className="flex bg-muted/5 border-b border-border/20">
                <div className="w-52 shrink-0 border-r border-border/30 px-3 py-2">
                  <div className="font-mono text-xs text-primary font-semibold">{item.item_code}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight truncate">{item.description}</div>
                  {item.category && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5 h-4">{item.category}</Badge>
                  )}
                </div>
                <div className="flex-1 h-10 relative overflow-hidden">
                  <GridLines />
                </div>
              </div>

              {/* PO sub-rows */}
              {poEntries.map(({ po, supplierName, linesForItem, allPoDeliveries, barStart, barEnd }) => {
                const deliveriesThisYear = allPoDeliveries.filter(d =>
                  new Date(d.scheduled_date).getFullYear() === year
                );
                const hasBar    = barStart !== null && barEnd !== null;
                const left      = Math.max(0,   barStart ?? 0);
                const right     = Math.min(100, barEnd   ?? 100);
                const width     = Math.max(0.5, right - left);
                const colorClass = PO_STATUS_COLORS[po.status] ?? PO_STATUS_COLORS.draft;
                const statusLabel = PO_STATUS_LABELS[po.status] ?? po.status;

                return (
                  <div key={po.id} className="flex group hover:bg-muted/10 transition-colors border-b border-border/10 last:border-0">
                    {/* Left info */}
                    <div className="w-52 shrink-0 border-r border-border/20 px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Truck className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        <span className="font-mono text-[11px] text-foreground/80">{po.po_number}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground ml-4 truncate">{supplierName}</div>
                      {linesForItem.length > 0 && (
                        <div className="text-[9px] text-muted-foreground/60 ml-4 font-mono">
                          qtà {linesForItem.reduce((s, l) => s + Number(l.quantity), 0)}
                        </div>
                      )}
                    </div>

                    {/* Timeline */}
                    <div className="flex-1 relative h-12 overflow-hidden">
                      <GridLines />

                      {/* PO span bar */}
                      {hasBar && (
                        <div
                          className={cn(
                            "absolute top-3 h-6 rounded border cursor-default flex items-center px-1 overflow-hidden",
                            colorClass
                          )}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${po.po_number} · ${statusLabel}\n${po.order_date ?? "?"} → ${po.requested_delivery_date ?? po.actual_delivery_date ?? "?"}`}
                        >
                          <span className="text-[9px] font-mono text-foreground/70 truncate select-none whitespace-nowrap">
                            {po.po_number}
                          </span>
                        </div>
                      )}

                      {/* Delivery markers */}
                      {deliveriesThisYear.map(d => {
                        const pct = dateToPct(d.scheduled_date, year);
                        if (pct === null || pct < 0 || pct > 100) return null;
                        const dot = DELIVERY_DOT[d.status] ?? DELIVERY_DOT.scheduled;
                        return (
                          <button
                            key={d.id}
                            className={cn(
                              "absolute z-30 w-3 h-3 rounded-full border shadow-sm",
                              "hover:scale-125 transition-transform cursor-pointer",
                              dot
                            )}
                            style={{ left: `${pct}%`, top: "50%", transform: "translate(-50%, -50%)" }}
                            title={`${DELIVERY_LABELS[d.status]} — ${d.scheduled_date} — qtà: ${d.quantity}${d.notes ? `\n${d.notes}` : ""}\nClic per eliminare`}
                            onClick={() => {
                              if (window.confirm(`Rimuovere consegna del ${d.scheduled_date}?`)) {
                                deleteMut.mutate(d.id);
                              }
                            }}
                          />
                        );
                      })}

                      {/* Add delivery button (hover) */}
                      <button
                        className="absolute right-1.5 top-3 opacity-0 group-hover:opacity-100 transition-opacity z-40"
                        title="Aggiungi consegna programmata"
                        onClick={() => {
                          setSelectedPoId(po.id);
                          setForm({ scheduled_date: "", quantity: "0", status: "scheduled", notes: "", po_line_id: "" });
                          setAddOpen(true);
                        }}
                      >
                        <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/20 hover:bg-primary/40 text-primary transition-colors">
                          <Plus className="h-3 w-3" />
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* WO sub-rows */}
              {showWO && woEntries.map(({ wo, barStart, barEnd }) => {
                const hasBar  = barStart !== null && barEnd !== null;
                const left    = Math.max(0,   barStart ?? 0);
                const right   = Math.min(100, barEnd   ?? 100);
                const width   = Math.max(0.5, right - left);
                return (
                  <div key={wo.id} className="flex hover:bg-muted/10 transition-colors border-b border-border/10 last:border-0">
                    <div className="w-52 shrink-0 border-r border-border/20 px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Factory className="h-3 w-3 text-violet-400/60 shrink-0" />
                        <span className="font-mono text-[11px] text-violet-400/80">{wo.wo_number}</span>
                      </div>
                      <div className="text-[9px] text-muted-foreground/60 ml-4 font-mono">qtà {wo.quantity_to_produce}</div>
                    </div>
                    <div className="flex-1 relative h-10 overflow-hidden">
                      <GridLines />
                      {hasBar && (
                        <div
                          className="absolute top-2.5 h-5 rounded border bg-violet-500/35 border-violet-500/25 cursor-default"
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${wo.wo_number}\n${wo.planned_start ?? "?"} → ${wo.planned_end ?? "?"}\nQtà: ${wo.quantity_to_produce}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Add Delivery Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              Programma Consegna
            </DialogTitle>
          </DialogHeader>

          {selectedPoId && (
            <div className="text-xs bg-muted/20 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">Ordine: </span>
              <span className="font-mono text-primary font-medium">
                {orders.find(o => o.id === selectedPoId)?.po_number}
              </span>
            </div>
          )}

          <form onSubmit={e => { e.preventDefault(); addMut.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data Consegna *</Label>
                <Input
                  type="date" className="font-mono"
                  value={form.scheduled_date}
                  onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Quantità *</Label>
                <Input
                  type="number" step="0.01" min="0" className="font-mono"
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                  required
                />
              </div>
            </div>

            {selectedPoLines.length > 0 && (
              <div>
                <Label className="text-xs">Riga specifica (opzionale)</Label>
                <Select
                  value={form.po_line_id}
                  onValueChange={v => setForm({ ...form, po_line_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Tutta l'ordine..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tutta l'ordine</SelectItem>
                    {selectedPoLines.map(line => {
                      const it = items.find(i => i.id === line.item_id);
                      return (
                        <SelectItem key={line.id} value={line.id}>
                          {it?.item_code} — {line.quantity}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs">Stato</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DELIVERY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Note</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2} placeholder="es. Lotto parziale, ETA da confermare..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={!form.scheduled_date || addMut.isPending} className="gap-1">
                <Plus className="h-4 w-4" /> Salva Consegna
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
