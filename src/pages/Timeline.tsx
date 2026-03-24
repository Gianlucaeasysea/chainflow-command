import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Package, Truck, Factory, Layers, Clock, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------- helpers ----------

const MONTHS_SHORT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

function daysInYear(y: number) { return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365; }
function dayOfYear(d: Date): number { return Math.ceil((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1; }
function dateToPct(dateStr: string, year: number): number | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  if (d.getFullYear() < year) return 0;
  if (d.getFullYear() > year) return 100;
  return ((dayOfYear(d) - 1) / daysInYear(year)) * 100;
}
function monthBoundaries(year: number) {
  return MONTHS_SHORT.map((label, i) => {
    const d = new Date(year, i, 1);
    return { label, pct: ((dayOfYear(d) - 1) / daysInYear(year)) * 100 };
  });
}

const PO_STATUS_LABELS: Record<string, string> = {
  draft: "Bozza", sent: "Inviato", confirmed: "Confermato",
  pre_series: "Pre-Serie", in_production: "In Produzione",
  shipping: "In Spedizione", customs: "In Dogana",
  delivered: "Consegnato", closed: "Chiuso", cancelled: "Annullato",
};
const PO_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted-foreground/30", sent: "bg-blue-500/40", confirmed: "bg-emerald-500/40",
  pre_series: "bg-purple-500/40", in_production: "bg-amber-500/40",
  shipping: "bg-cyan-500/40", customs: "bg-orange-500/40",
  delivered: "bg-emerald-400/50", closed: "bg-muted-foreground/20", cancelled: "bg-red-500/30",
};
const WO_STATUS_LABELS: Record<string, string> = {
  planned: "Pianificato", in_progress: "In Corso", completed: "Completato", on_hold: "In Pausa",
};

// ---------- types ----------
type Item = { id: string; item_code: string; description: string; item_type: string | null; unit_of_measure: string };
type PO = { id: string; po_number: string; supplier_id: string; status: string; order_date: string | null; requested_delivery_date: string | null; actual_delivery_date: string | null; product_item_id: string | null };
type PoLine = { id: string; purchase_order_id: string; item_id: string; quantity: number };
type PoDelivery = { id: string; purchase_order_id: string; po_line_id: string | null; scheduled_date: string; quantity: number; status: string; actual_delivery_date: string | null; notes: string | null };
type WO = { id: string; wo_number: string; product_item_id: string; quantity_to_produce: number; status: string; planned_start: string | null; planned_end: string | null; actual_start: string | null; actual_end: string | null };
type Lot = { id: string; item_id: string; lot_number: string; quantity_on_hand: number; status: string; purchase_order_id: string | null; expiry_date: string | null };
type Supplier = { id: string; company_name: string };

export default function TimelinePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  const { data: items = [] } = useQuery<Item[]>({ queryKey: ["items"], queryFn: async () => { const { data, error } = await supabase.from("items").select("id,item_code,description,item_type,unit_of_measure").order("item_code"); if (error) throw error; return data as Item[]; } });
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: async () => { const { data, error } = await supabase.from("suppliers").select("id,company_name"); if (error) throw error; return data as Supplier[]; } });
  const { data: orders = [] } = useQuery<PO[]>({ queryKey: ["purchase_orders"], queryFn: async () => { const { data, error } = await (supabase.from as any)("purchase_orders").select("id,po_number,supplier_id,status,order_date,requested_delivery_date,actual_delivery_date,product_item_id"); if (error) throw error; return data as PO[]; } });
  const { data: poLines = [] } = useQuery<PoLine[]>({ queryKey: ["all_po_lines"], queryFn: async () => { const { data, error } = await supabase.from("po_lines").select("id,purchase_order_id,item_id,quantity"); if (error) throw error; return data as PoLine[]; } });
  const { data: deliveries = [] } = useQuery<PoDelivery[]>({ queryKey: ["po_deliveries"], queryFn: async () => { const { data, error } = await (supabase.from as any)("po_deliveries").select("*").order("scheduled_date"); if (error) { console.warn(error.message); return []; } return data as PoDelivery[]; } });
  const { data: wos = [] } = useQuery<WO[]>({ queryKey: ["production_orders"], queryFn: async () => { const { data, error } = await supabase.from("production_orders").select("id,wo_number,product_item_id,quantity_to_produce,status,planned_start,planned_end,actual_start,actual_end"); if (error) throw error; return data as WO[]; } });
  const { data: lots = [] } = useQuery<Lot[]>({ queryKey: ["inventory_lots"], queryFn: async () => { const { data, error } = await supabase.from("inventory_lots").select("id,item_id,lot_number,quantity_on_hand,status,purchase_order_id,expiry_date"); if (error) throw error; return data as Lot[]; } });

  const months = useMemo(() => monthBoundaries(year), [year]);
  const todayPct = useMemo(() => {
    const t = new Date();
    return t.getFullYear() === year ? ((dayOfYear(t) - 1) / daysInYear(year)) * 100 : null;
  }, [year]);

  const getItem = (id: string) => items.find(i => i.id === id);
  const getSupplier = (id: string) => suppliers.find(s => s.id === id);

  // Group everything by product
  const productGroups = useMemo(() => {
    const groups = new Map<string, {
      product: Item;
      pos: PO[];
      wos: WO[];
      lots: Lot[];
    }>();

    // Group POs by product_item_id
    orders.filter(o => o.product_item_id && o.status !== "cancelled").forEach(po => {
      const pid = po.product_item_id!;
      if (!groups.has(pid)) {
        const product = getItem(pid);
        if (!product) return;
        groups.set(pid, { product, pos: [], wos: [], lots: [] });
      }
      groups.get(pid)!.pos.push(po);
    });

    // Group WOs by product
    wos.forEach(wo => {
      const pid = wo.product_item_id;
      if (!groups.has(pid)) {
        const product = getItem(pid);
        if (!product) return;
        groups.set(pid, { product, pos: [], wos: [], lots: [] });
      }
      groups.get(pid)!.wos.push(wo);
    });

    // Group lots by item (components related to POs of this product)
    // Lots linked to POs of a product
    groups.forEach((g) => {
      const poIds = new Set(g.pos.map(po => po.id));
      const relatedLots = lots.filter(l => l.purchase_order_id && poIds.has(l.purchase_order_id));
      g.lots = relatedLots;
    });

    return Array.from(groups.values()).sort((a, b) => a.product.item_code.localeCompare(b.product.item_code));
  }, [items, orders, wos, lots]);

  // Unassigned POs
  const unassignedPOs = useMemo(() => orders.filter(o => !o.product_item_id && o.status !== "cancelled"), [orders]);

  const toggleProduct = (id: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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

  const renderBar = (start: string | null, end: string | null, colorClass: string, label: string) => {
    const s = start ? dateToPct(start, year) : null;
    const e = end ? dateToPct(end, year) : null;
    if (s === null && e === null) return null;
    const left = Math.max(0, s ?? 0);
    const right = Math.min(100, e ?? 100);
    const width = Math.max(0.5, right - left);
    return (
      <div
        className={cn("absolute top-1/2 -translate-y-1/2 h-5 rounded border transition-opacity", colorClass)}
        style={{ left: `${left}%`, width: `${width}%` }}
        title={label}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Timeline Prodotto</h1>
          <p className="text-sm text-muted-foreground">Raggruppa ordini, produzione e lotti per prodotto finito</p>
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

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-5 h-3 rounded bg-emerald-500/40 inline-block" /> PO Confermato</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-3 rounded bg-amber-500/40 inline-block" /> In Produzione</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-3 rounded bg-cyan-500/40 inline-block" /> In Spedizione</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-3 rounded bg-violet-500/40 inline-block" /> Ordine Produzione</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Consegna programmata</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Consegna ricevuta</span>
        <span className="flex items-center gap-1.5"><span className="w-0.5 h-3.5 bg-primary/60 inline-block" /> Oggi</span>
      </div>

      {/* Main content */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Month header */}
        <div className="flex border-b border-border bg-muted/30">
          <div className="w-72 shrink-0 border-r border-border flex items-center px-3 py-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Prodotto / Dettaglio</span>
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
          {productGroups.length === 0 && unassignedPOs.length === 0 ? (
            <div className="p-14 text-center text-muted-foreground text-sm">
              Nessun dato nel {year}. Crea ordini e associali a un prodotto finito.
            </div>
          ) : (
            <>
              {productGroups.map(({ product, pos, wos: productWOs, lots: productLots }) => {
                const isExpanded = expandedProducts.has(product.id);
                const totalPOs = pos.length;
                const totalWOs = productWOs.length;
                const totalLots = productLots.length;
                const totalDeliveries = pos.reduce((s, po) => s + deliveries.filter(d => d.purchase_order_id === po.id).length, 0);

                return (
                  <div key={product.id} className="border-b border-border/40">
                    {/* Product header row */}
                    <div
                      className="flex hover:bg-muted/10 cursor-pointer transition-colors"
                      onClick={() => toggleProduct(product.id)}
                    >
                      <div className="w-72 shrink-0 border-r border-border/30 px-3 py-3">
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                          <Package className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <div className="font-mono text-sm text-primary font-semibold">{product.item_code}</div>
                            <div className="text-[10px] text-muted-foreground leading-tight truncate">{product.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 ml-10">
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-1"><Truck className="h-2.5 w-2.5" />{totalPOs} PO</Badge>
                          {totalWOs > 0 && <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-1"><Factory className="h-2.5 w-2.5" />{totalWOs} WO</Badge>}
                          {totalLots > 0 && <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-1"><Layers className="h-2.5 w-2.5" />{totalLots} lotti</Badge>}
                          {totalDeliveries > 0 && <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-1">{totalDeliveries} consegne</Badge>}
                        </div>
                      </div>
                      <div className="flex-1 relative h-16 overflow-hidden">
                        <GridLines />
                        {/* Overview bars for all POs */}
                        {pos.map((po, idx) => {
                          const colorClass = PO_STATUS_COLORS[po.status] ?? PO_STATUS_COLORS.draft;
                          const s = po.order_date ? dateToPct(po.order_date, year) : null;
                          const e = (po.actual_delivery_date || po.requested_delivery_date) ? dateToPct(po.actual_delivery_date || po.requested_delivery_date!, year) : null;
                          if (s === null && e === null) return null;
                          const left = Math.max(0, s ?? 0);
                          const right = Math.min(100, e ?? 100);
                          const width = Math.max(0.3, right - left);
                          const top = 4 + idx * 7;
                          return (
                            <div key={po.id}
                              className={cn("absolute h-4 rounded border opacity-80", colorClass)}
                              style={{ left: `${left}%`, width: `${width}%`, top: `${top}px` }}
                              title={`${po.po_number} — ${PO_STATUS_LABELS[po.status]}`}
                            />
                          );
                        })}
                        {/* WO bars */}
                        {productWOs.map((wo) => {
                          const startDate = wo.actual_start || wo.planned_start;
                          const endDate = wo.actual_end || wo.planned_end;
                          const s = startDate ? dateToPct(startDate, year) : null;
                          const e = endDate ? dateToPct(endDate, year) : null;
                          if (s === null && e === null) return null;
                          const left = Math.max(0, s ?? 0);
                          const right = Math.min(100, e ?? 100);
                          const width = Math.max(0.3, right - left);
                          return (
                            <div key={wo.id}
                              className="absolute h-4 rounded border bg-violet-500/40 border-violet-500/30 opacity-80"
                              style={{ left: `${left}%`, width: `${width}%`, bottom: "4px" }}
                              title={`${wo.wo_number} — ${WO_STATUS_LABELS[wo.status] || wo.status}`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="bg-muted/5">
                        {/* Purchase Orders */}
                        {pos.map(po => {
                          const supplier = getSupplier(po.supplier_id);
                          const lines = poLines.filter(l => l.purchase_order_id === po.id);
                          const dels = deliveries.filter(d => d.purchase_order_id === po.id);
                          const isPoExpanded = expandedPO === po.id;
                          const lt = po.order_date && po.actual_delivery_date
                            ? Math.round((new Date(po.actual_delivery_date).getTime() - new Date(po.order_date).getTime()) / 86400000) : null;

                          return (
                            <div key={po.id} className="border-b border-border/10 last:border-0">
                              <div
                                className="flex hover:bg-muted/10 cursor-pointer transition-colors"
                                onClick={() => setExpandedPO(isPoExpanded ? null : po.id)}
                              >
                                <div className="w-72 shrink-0 border-r border-border/20 px-3 py-2 pl-10">
                                  <div className="flex items-center gap-2">
                                    <Truck className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                    <span className="font-mono text-xs text-foreground/80">{po.po_number}</span>
                                    <Badge className={cn("text-[9px] h-4 px-1.5", PO_STATUS_COLORS[po.status])}>{PO_STATUS_LABELS[po.status]}</Badge>
                                    {lt !== null && <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">{lt}gg</Badge>}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground ml-5 truncate">{supplier?.company_name || "—"}</div>
                                </div>
                                <div className="flex-1 relative h-10 overflow-hidden">
                                  <GridLines />
                                  {renderBar(po.order_date, po.actual_delivery_date || po.requested_delivery_date, cn("border", PO_STATUS_COLORS[po.status]), po.po_number)}
                                  {/* Delivery dots */}
                                  {dels.map(d => {
                                    const pct = dateToPct(d.scheduled_date, year);
                                    if (pct === null) return null;
                                    const isReceived = d.status === "received" || !!d.actual_delivery_date;
                                    return (
                                      <div key={d.id}
                                        className={cn("absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border z-10", isReceived ? "bg-emerald-400 border-emerald-300" : "bg-blue-400 border-blue-300")}
                                        style={{ left: `${pct}%`, marginLeft: "-5px" }}
                                        title={`Consegna ${d.scheduled_date} — ${d.quantity} pz`}
                                      />
                                    );
                                  })}
                                </div>
                              </div>

                              {/* PO expanded detail */}
                              {isPoExpanded && (
                                <div className="bg-muted/10 px-10 py-3 space-y-3">
                                  {/* Info grid */}
                                  <div className="grid grid-cols-4 gap-2 text-xs">
                                    <div className="bg-background/50 rounded p-2">
                                      <span className="text-muted-foreground text-[10px] font-mono uppercase block">Data Ordine</span>
                                      <span className="font-mono text-foreground">{po.order_date || "—"}</span>
                                    </div>
                                    <div className="bg-background/50 rounded p-2">
                                      <span className="text-muted-foreground text-[10px] font-mono uppercase block">Consegna Rich.</span>
                                      <span className="font-mono text-foreground">{po.requested_delivery_date || "—"}</span>
                                    </div>
                                    <div className="bg-background/50 rounded p-2">
                                      <span className="text-muted-foreground text-[10px] font-mono uppercase block">Consegna Eff.</span>
                                      <span className="font-mono text-foreground">{po.actual_delivery_date || "In attesa"}</span>
                                    </div>
                                    <div className="bg-background/50 rounded p-2">
                                      <span className="text-muted-foreground text-[10px] font-mono uppercase block">Lead Time</span>
                                      <span className="font-mono text-foreground">{lt !== null ? `${lt} giorni` : "—"}</span>
                                    </div>
                                  </div>

                                  {/* Lines */}
                                  {lines.length > 0 && (
                                    <div>
                                      <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Componenti ordinati</h4>
                                      <div className="grid grid-cols-2 gap-1.5">
                                        {lines.map(line => {
                                          const item = getItem(line.item_id);
                                          return (
                                            <div key={line.id} className="flex items-center gap-2 bg-background/50 rounded px-2 py-1.5 text-xs">
                                              <span className="font-mono text-primary font-medium">{item?.item_code || "?"}</span>
                                              <span className="text-muted-foreground truncate flex-1">{item?.description}</span>
                                              <span className="font-mono text-foreground shrink-0">{Number(line.quantity)} {item?.unit_of_measure}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Deliveries */}
                                  {dels.length > 0 && (
                                    <div>
                                      <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Consegne</h4>
                                      <div className="space-y-1">
                                        {dels.map(d => {
                                          const lineItem = d.po_line_id ? poLines.find(l => l.id === d.po_line_id) : null;
                                          const lineItemData = lineItem ? getItem(lineItem.item_id) : null;
                                          const isReceived = d.status === "received" || !!d.actual_delivery_date;
                                          return (
                                            <div key={d.id} className="flex items-center gap-3 bg-background/50 rounded px-2 py-1.5 text-xs">
                                              <span className={cn("w-2 h-2 rounded-full shrink-0", isReceived ? "bg-emerald-400" : "bg-blue-400")} />
                                              <span className="font-mono text-foreground">{d.scheduled_date}</span>
                                              {d.actual_delivery_date && (
                                                <span className="font-mono text-emerald-400 flex items-center gap-1">
                                                  <Check className="h-3 w-3" /> {d.actual_delivery_date}
                                                </span>
                                              )}
                                              {lineItemData && <span className="font-mono text-primary">{lineItemData.item_code}</span>}
                                              <span className="font-mono text-muted-foreground">{Number(d.quantity)} pz</span>
                                              {d.notes && <span className="text-muted-foreground truncate">{d.notes}</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Production Orders */}
                        {productWOs.map(wo => {
                          const startDate = wo.actual_start || wo.planned_start;
                          const endDate = wo.actual_end || wo.planned_end;
                          const prodDays = startDate && endDate ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) : null;

                          return (
                            <div key={wo.id} className="flex border-b border-border/10 last:border-0 hover:bg-muted/10 transition-colors">
                              <div className="w-72 shrink-0 border-r border-border/20 px-3 py-2 pl-10">
                                <div className="flex items-center gap-2">
                                  <Factory className="h-3 w-3 text-violet-400 shrink-0" />
                                  <span className="font-mono text-xs text-foreground/80">{wo.wo_number}</span>
                                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">{WO_STATUS_LABELS[wo.status] || wo.status}</Badge>
                                  {prodDays !== null && <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">{prodDays}gg</Badge>}
                                </div>
                                <div className="text-[10px] text-muted-foreground ml-5">{wo.quantity_to_produce} pz</div>
                              </div>
                              <div className="flex-1 relative h-10 overflow-hidden">
                                <GridLines />
                                {renderBar(startDate, endDate, "bg-violet-500/40 border-violet-500/30", wo.wo_number)}
                              </div>
                            </div>
                          );
                        })}

                        {/* Lots */}
                        {productLots.length > 0 && (
                          <div className="px-10 py-2">
                            <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1"><Layers className="h-3 w-3" /> Lotti collegati</h4>
                            <div className="grid grid-cols-3 gap-1.5">
                              {productLots.map(lot => {
                                const item = getItem(lot.item_id);
                                const lotStatusColors: Record<string, string> = { available: "text-emerald-400", quarantine: "text-amber-400", expired: "text-destructive" };
                                return (
                                  <div key={lot.id} className="bg-background/50 rounded px-2 py-1.5 text-xs flex items-center gap-2">
                                    <span className={cn("font-mono font-medium", lotStatusColors[lot.status] || "text-foreground")}>{lot.lot_number}</span>
                                    <span className="text-muted-foreground truncate flex-1">{item?.item_code}</span>
                                    <span className="font-mono text-foreground shrink-0">{Number(lot.quantity_on_hand)} {item?.unit_of_measure}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Unassigned POs */}
              {unassignedPOs.length > 0 && (
                <div className="border-b border-border/40">
                  <div
                    className="flex hover:bg-muted/10 cursor-pointer transition-colors"
                    onClick={() => toggleProduct("__unassigned__")}
                  >
                    <div className="w-72 shrink-0 border-r border-border/30 px-3 py-3">
                      <div className="flex items-center gap-2">
                        {expandedProducts.has("__unassigned__") ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-sm text-muted-foreground font-medium">Ordini non assegnati</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5">{unassignedPOs.length}</Badge>
                      </div>
                    </div>
                    <div className="flex-1 relative h-10 overflow-hidden">
                      <GridLines />
                    </div>
                  </div>
                  {expandedProducts.has("__unassigned__") && (
                    <div className="bg-muted/5">
                      {unassignedPOs.map(po => {
                        const supplier = getSupplier(po.supplier_id);
                        return (
                          <div key={po.id} className="flex border-b border-border/10 last:border-0 hover:bg-muted/10 transition-colors">
                            <div className="w-72 shrink-0 border-r border-border/20 px-3 py-2 pl-10">
                              <div className="flex items-center gap-2">
                                <Truck className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                <span className="font-mono text-xs text-foreground/80">{po.po_number}</span>
                                <Badge className={cn("text-[9px] h-4 px-1.5", PO_STATUS_COLORS[po.status])}>{PO_STATUS_LABELS[po.status]}</Badge>
                              </div>
                              <div className="text-[10px] text-muted-foreground ml-5">{supplier?.company_name || "—"}</div>
                            </div>
                            <div className="flex-1 relative h-10 overflow-hidden">
                              <GridLines />
                              {renderBar(po.order_date, po.actual_delivery_date || po.requested_delivery_date, cn("border", PO_STATUS_COLORS[po.status]), po.po_number)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
