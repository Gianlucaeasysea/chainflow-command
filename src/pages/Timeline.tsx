import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Package, Truck, Factory, Layers, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  startOfYear, endOfYear, eachMonthOfInterval, eachWeekOfInterval,
  differenceInDays, format, parseISO, startOfWeek, addWeeks, subMonths,
  startOfQuarter,
} from "date-fns";
import { it } from "date-fns/locale";

// ---------- types ----------
type Item = { id: string; item_code: string; description: string; item_type: string | null; category: string | null; unit_of_measure: string };
type PO = { id: string; po_number: string; supplier_id: string; status: string; order_date: string | null; requested_delivery_date: string | null; actual_delivery_date: string | null; product_item_id: string | null };
type PoLine = { id: string; purchase_order_id: string; item_id: string; quantity: number };
type PoDelivery = { id: string; purchase_order_id: string; po_line_id: string | null; scheduled_date: string; quantity: number; status: string; actual_delivery_date: string | null; notes: string | null };
type WO = { id: string; wo_number: string; product_item_id: string; quantity_to_produce: number; status: string; planned_start: string | null; planned_end: string | null; actual_start: string | null; actual_end: string | null };
type Lot = { id: string; item_id: string; lot_number: string; quantity_on_hand: number; status: string; purchase_order_id: string | null; expiry_date: string | null };
type Supplier = { id: string; company_name: string };
type BomLine = { bom_header_id: string; component_item_id: string };
type BomHeader = { id: string; item_id: string };

// ---------- status colors ----------
const PO_STATUS_LABELS: Record<string, string> = {
  draft: "Bozza", sent: "Inviato", confirmed: "Confermato",
  pre_series: "Pre-Serie", in_production: "In Produzione",
  shipping: "In Spedizione", customs: "In Dogana",
  delivered: "Consegnato", closed: "Chiuso", cancelled: "Annullato",
};
const PO_BAR_COLORS: Record<string, string> = {
  draft: "bg-slate-300 border-slate-400",
  sent: "bg-blue-400 border-blue-500",
  confirmed: "bg-indigo-400 border-indigo-500",
  in_production: "bg-orange-400 border-orange-500",
  shipping: "bg-yellow-400 border-yellow-500",
  delivered: "bg-green-500 border-green-600",
  closed: "bg-green-700 border-green-800",
  cancelled: "bg-red-300 border-red-400",
};
const WO_STATUS_LABELS: Record<string, string> = {
  planned: "Pianificato", in_progress: "In Corso", completed: "Completato", on_hold: "In Pausa",
  pianificato: "Pianificato", materiali_allocati: "Materiali Allocati",
  in_lavorazione: "In Lavorazione", controllo_qualita: "Controllo Qualità",
  completato: "Completato", chiuso: "Chiuso",
};
const WO_BAR_COLORS: Record<string, string> = {
  planned: "bg-slate-300 border-slate-400",
  pianificato: "bg-slate-300 border-slate-400",
  materiali_allocati: "bg-cyan-400 border-cyan-500",
  in_progress: "bg-orange-400 border-orange-500",
  in_lavorazione: "bg-orange-400 border-orange-500",
  controllo_qualita: "bg-purple-400 border-purple-500",
  completed: "bg-green-500 border-green-600",
  completato: "bg-green-500 border-green-600",
  chiuso: "bg-green-700 border-green-800",
  on_hold: "bg-yellow-300 border-yellow-400",
};

type ZoomLevel = "weeks" | "months" | "quarters";
const RECORD_LIMIT = 100;

export default function TimelinePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("months");
  const [productFilter, setProductFilter] = useState<string>("__all__");
  const [loadAll, setLoadAll] = useState(false);

  // date-fns based reference dates
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));
  const totalDays = differenceInDays(yearEnd, yearStart) + 1;

  function dateToPct(dateStr: string): number | null {
    try {
      const d = parseISO(dateStr);
      if (isNaN(d.getTime())) return null;
      if (d < yearStart) return 0;
      if (d > yearEnd) return 100;
      return (differenceInDays(d, yearStart) / totalDays) * 100;
    } catch { return null; }
  }

  // Zoom-aware grid columns
  const gridColumns = useMemo(() => {
    if (zoom === "months") {
      return eachMonthOfInterval({ start: yearStart, end: yearEnd }).map(d => ({
        label: format(d, "MMM", { locale: it }),
        pct: (differenceInDays(d, yearStart) / totalDays) * 100,
      }));
    }
    if (zoom === "quarters") {
      return [0, 1, 2, 3].map(q => {
        const d = startOfQuarter(new Date(year, q * 3, 1));
        return {
          label: `Q${q + 1}`,
          pct: (differenceInDays(d < yearStart ? yearStart : d, yearStart) / totalDays) * 100,
        };
      });
    }
    // weeks — show 12 weeks around today
    const now = new Date();
    const weekStart = startOfWeek(subMonths(now, 1), { weekStartsOn: 1 });
    const weeks = eachWeekOfInterval({ start: weekStart, end: addWeeks(weekStart, 11) }, { weekStartsOn: 1 });
    return weeks.map(d => ({
      label: format(d, "dd/MM", { locale: it }),
      pct: (differenceInDays(d < yearStart ? yearStart : d, yearStart) / totalDays) * 100,
    }));
  }, [year, zoom, totalDays]);

  const todayPct = useMemo(() => {
    const now = new Date();
    if (now.getFullYear() !== year) return null;
    return (differenceInDays(now, yearStart) / totalDays) * 100;
  }, [year, totalDays]);

  // ---- Queries ----
  const sixMonthsAgo = subMonths(new Date(), 6).toISOString().slice(0, 10);

  const { data: items = [] } = useQuery<Item[]>({ queryKey: ["items"], queryFn: async () => { const { data, error } = await supabase.from("items").select("id,item_code,description,item_type,category,unit_of_measure").order("item_code"); if (error) throw error; return data as Item[]; } });
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: async () => { const { data, error } = await supabase.from("suppliers").select("id,company_name"); if (error) throw error; return data as Supplier[]; } });

  const { data: ordersRaw = [], } = useQuery<PO[]>({
    queryKey: ["purchase_orders_timeline", loadAll],
    queryFn: async () => {
      let q = supabase.from("purchase_orders").select("id,po_number,supplier_id,status,order_date,requested_delivery_date,actual_delivery_date,product_item_id").order("order_date", { ascending: false });
      if (!loadAll) q = q.gte("order_date", sixMonthsAgo).limit(RECORD_LIMIT);
      const { data, error } = await (q as any);
      if (error) throw error;
      return data as PO[];
    },
  });
  const showLimitBanner = !loadAll && ordersRaw.length >= RECORD_LIMIT;
  const orders = ordersRaw;

  const { data: poLines = [] } = useQuery<PoLine[]>({ queryKey: ["all_po_lines"], queryFn: async () => { const { data, error } = await supabase.from("po_lines").select("id,purchase_order_id,item_id,quantity"); if (error) throw error; return data as PoLine[]; } });
  const { data: deliveries = [] } = useQuery<PoDelivery[]>({ queryKey: ["po_deliveries"], queryFn: async () => { const { data, error } = await (supabase.from as any)("po_deliveries").select("*").order("scheduled_date"); if (error) { console.warn(error.message); return []; } return data as PoDelivery[]; } });
  const { data: wos = [] } = useQuery<WO[]>({ queryKey: ["production_orders"], queryFn: async () => { const { data, error } = await supabase.from("production_orders").select("id,wo_number,product_item_id,quantity_to_produce,status,planned_start,planned_end,actual_start,actual_end"); if (error) throw error; return data as WO[]; } });
  const { data: lots = [] } = useQuery<Lot[]>({ queryKey: ["inventory_lots"], queryFn: async () => { const { data, error } = await supabase.from("inventory_lots").select("id,item_id,lot_number,quantity_on_hand,status,purchase_order_id,expiry_date"); if (error) throw error; return data as Lot[]; } });
  const { data: bomHeaders = [] } = useQuery<BomHeader[]>({ queryKey: ["bom_headers_tl"], queryFn: async () => { const { data, error } = await supabase.from("bom_headers").select("id,item_id"); if (error) throw error; return data as BomHeader[]; } });
  const { data: bomLines = [] } = useQuery<BomLine[]>({ queryKey: ["bom_lines_tl"], queryFn: async () => { const { data, error } = await supabase.from("bom_lines").select("bom_header_id,component_item_id"); if (error) throw error; return data as BomLine[]; } });

  const getItem = (id: string) => items.find(i => i.id === id);
  const getSupplier = (id: string) => suppliers.find(s => s.id === id);

  // Finished products for filter
  const finishedProducts = useMemo(() =>
    items.filter(i => i.category === "finished_product" || i.item_type === "finished_product").sort((a, b) => a.item_code.localeCompare(b.item_code)),
    [items]);

  // Component item ids for a given product (via BOM)
  const getComponentIds = (productId: string): Set<string> => {
    const headers = bomHeaders.filter(h => h.item_id === productId);
    const compIds = new Set<string>();
    headers.forEach(h => {
      bomLines.filter(l => l.bom_header_id === h.id).forEach(l => compIds.add(l.component_item_id));
    });
    return compIds;
  };

  // Group by product
  const productGroups = useMemo(() => {
    const groups = new Map<string, { product: Item; pos: PO[]; wos: WO[]; lots: Lot[] }>();

    orders.filter(o => o.product_item_id && o.status !== "cancelled").forEach(po => {
      const pid = po.product_item_id!;
      if (!groups.has(pid)) {
        const product = getItem(pid);
        if (!product) return;
        groups.set(pid, { product, pos: [], wos: [], lots: [] });
      }
      groups.get(pid)!.pos.push(po);
    });

    wos.forEach(wo => {
      const pid = wo.product_item_id;
      if (!groups.has(pid)) {
        const product = getItem(pid);
        if (!product) return;
        groups.set(pid, { product, pos: [], wos: [], lots: [] });
      }
      groups.get(pid)!.wos.push(wo);
    });

    groups.forEach(g => {
      const poIds = new Set(g.pos.map(po => po.id));
      g.lots = lots.filter(l => l.purchase_order_id && poIds.has(l.purchase_order_id));
    });

    let result = Array.from(groups.values()).sort((a, b) => a.product.item_code.localeCompare(b.product.item_code));

    // Apply product filter
    if (productFilter !== "__all__") {
      const compIds = getComponentIds(productFilter);
      result = result.filter(g => {
        if (g.product.id === productFilter) return true;
        // Include groups whose POs contain components of the filtered product
        return g.pos.some(po => {
          const lineItems = poLines.filter(l => l.purchase_order_id === po.id).map(l => l.item_id);
          return lineItems.some(id => compIds.has(id));
        });
      });
    }

    return result;
  }, [items, orders, wos, lots, productFilter, bomHeaders, bomLines, poLines]);

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
      {gridColumns.map((m, i) => (
        <div key={i} className="absolute inset-y-0 w-px bg-border/20" style={{ left: `${m.pct}%` }} />
      ))}
      {todayPct !== null && (
        <div className="absolute inset-y-0 w-0.5 bg-primary/40 z-20" style={{ left: `${todayPct}%` }} />
      )}
    </>
  );

  const renderBar = (start: string | null, end: string | null, colorClass: string, label: string) => {
    const s = start ? dateToPct(start) : null;
    const e = end ? dateToPct(end) : null;
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Timeline Prodotto</h1>
          <p className="text-sm text-muted-foreground">Raggruppa ordini, produzione e lotti per prodotto finito</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Product filter */}
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-56 h-8 text-xs">
              <SelectValue placeholder="Filtra per prodotto finito" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti i prodotti</SelectItem>
              {finishedProducts.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.item_code} — {p.description}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Zoom */}
          <div className="flex border border-border rounded-md overflow-hidden">
            {(["weeks", "months", "quarters"] as ZoomLevel[]).map(z => (
              <button key={z} onClick={() => setZoom(z)}
                className={cn("px-3 py-1 text-xs font-mono transition-colors", zoom === z ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted/50 text-muted-foreground")}>
                {z === "weeks" ? "Settimane" : z === "months" ? "Mesi" : "Trimestri"}
              </button>
            ))}
          </div>
          {/* Year nav */}
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

      {/* Limit banner */}
      {showLimitBanner && (
        <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-4 py-2 text-sm">
          <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Visualizzando i {RECORD_LIMIT} record più recenti.</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-primary" onClick={() => setLoadAll(true)}>Carica tutti</Button>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-5 h-3 rounded bg-slate-300 inline-block" /> Bozza</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-3 rounded bg-blue-400 inline-block" /> Inviato</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-3 rounded bg-indigo-400 inline-block" /> Confermato</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-3 rounded bg-orange-400 inline-block" /> In Produzione</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-3 rounded bg-green-500 inline-block" /> Consegnato</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-3 rounded bg-purple-400 inline-block" /> ODP</span>
        <span className="flex items-center gap-1.5"><span className="w-0.5 h-3.5 bg-primary/60 inline-block" /> Oggi</span>
      </div>

      {/* Main content */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Grid header */}
        <div className="flex border-b border-border bg-muted/30">
          <div className="w-72 shrink-0 border-r border-border flex items-center px-3 py-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Prodotto / Dettaglio</span>
          </div>
          <div className="flex-1 relative h-8 overflow-hidden">
            {gridColumns.map(({ label, pct }, i) => (
              <div key={i} className="absolute top-0 bottom-0" style={{ left: `${pct}%` }}>
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
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
          {productGroups.length === 0 && unassignedPOs.length === 0 ? (
            <div className="p-14 text-center text-muted-foreground text-sm">
              Nessun dato nel {year}. Crea ordini e associali a un prodotto finito.
            </div>
          ) : (
            <>
              {productGroups.map(({ product, pos, wos: productWOs, lots: productLots }) => {
                const isExpanded = expandedProducts.has(product.id);
                const totalDeliveries = pos.reduce((s, po) => s + deliveries.filter(d => d.purchase_order_id === po.id).length, 0);

                return (
                  <div key={product.id} className="border-b border-border/40">
                    {/* Product header */}
                    <div className="flex hover:bg-muted/10 cursor-pointer transition-colors" onClick={() => toggleProduct(product.id)}>
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
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-1"><Truck className="h-2.5 w-2.5" />{pos.length} PO</Badge>
                          {productWOs.length > 0 && <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-1"><Factory className="h-2.5 w-2.5" />{productWOs.length} WO</Badge>}
                          {productLots.length > 0 && <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-1"><Layers className="h-2.5 w-2.5" />{productLots.length} lotti</Badge>}
                          {totalDeliveries > 0 && <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-1">{totalDeliveries} consegne</Badge>}
                        </div>
                      </div>
                      <div className="flex-1 relative h-16 overflow-hidden">
                        <GridLines />
                        {pos.map((po, idx) => {
                          const colorClass = PO_BAR_COLORS[po.status] ?? PO_BAR_COLORS.draft;
                          const s = po.order_date ? dateToPct(po.order_date) : null;
                          const e = (po.actual_delivery_date || po.requested_delivery_date) ? dateToPct(po.actual_delivery_date || po.requested_delivery_date!) : null;
                          if (s === null && e === null) return null;
                          const left = Math.max(0, s ?? 0);
                          const right = Math.min(100, e ?? 100);
                          const width = Math.max(0.3, right - left);
                          const top = 4 + idx * 7;
                          return (
                            <div key={po.id} className={cn("absolute h-4 rounded border opacity-80", colorClass)} style={{ left: `${left}%`, width: `${width}%`, top: `${top}px` }} title={`${po.po_number} — ${PO_STATUS_LABELS[po.status]}`} />
                          );
                        })}
                        {productWOs.map(wo => {
                          const startDate = wo.actual_start || wo.planned_start;
                          const endDate = wo.actual_end || wo.planned_end;
                          const woColor = WO_BAR_COLORS[wo.status] ?? "bg-violet-500/40 border-violet-500/30";
                          const s = startDate ? dateToPct(startDate) : null;
                          const e = endDate ? dateToPct(endDate) : null;
                          if (s === null && e === null) return null;
                          const left = Math.max(0, s ?? 0);
                          const right = Math.min(100, e ?? 100);
                          const width = Math.max(0.3, right - left);
                          return <div key={wo.id} className={cn("absolute h-4 rounded border opacity-80", woColor)} style={{ left: `${left}%`, width: `${width}%`, bottom: "4px" }} title={`${wo.wo_number} — ${WO_STATUS_LABELS[wo.status] || wo.status}`} />;
                        })}
                      </div>
                    </div>

                    {/* Expanded */}
                    {isExpanded && (
                      <div className="bg-muted/5">
                        {pos.map(po => {
                          const supplier = getSupplier(po.supplier_id);
                          const lines = poLines.filter(l => l.purchase_order_id === po.id);
                          const dels = deliveries.filter(d => d.purchase_order_id === po.id);
                          const isPoExpanded = expandedPO === po.id;
                          const lt = po.order_date && po.actual_delivery_date
                            ? differenceInDays(parseISO(po.actual_delivery_date), parseISO(po.order_date)) : null;
                          const poColor = PO_BAR_COLORS[po.status] ?? PO_BAR_COLORS.draft;

                          return (
                            <div key={po.id} className="border-b border-border/10 last:border-0">
                              <div className="flex hover:bg-muted/10 cursor-pointer transition-colors" onClick={() => setExpandedPO(isPoExpanded ? null : po.id)}>
                                <div className="w-72 shrink-0 border-r border-border/20 px-3 py-2 pl-10">
                                  <div className="flex items-center gap-2">
                                    <Truck className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                    <span className="font-mono text-xs text-foreground/80">{po.po_number}</span>
                                    <Badge className={cn("text-[9px] h-4 px-1.5", poColor)}>{PO_STATUS_LABELS[po.status]}</Badge>
                                    {lt !== null && <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">{lt}gg</Badge>}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground ml-5 truncate">{supplier?.company_name || "—"}</div>
                                </div>
                                <div className="flex-1 relative h-10 overflow-hidden">
                                  <GridLines />
                                  {renderBar(po.order_date, po.actual_delivery_date || po.requested_delivery_date, cn("border", poColor), po.po_number)}
                                  {dels.map(d => {
                                    const pct = dateToPct(d.scheduled_date);
                                    if (pct === null) return null;
                                    const isReceived = d.status === "received" || !!d.actual_delivery_date;
                                    return (
                                      <div key={d.id} className={cn("absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border z-10", isReceived ? "bg-emerald-400 border-emerald-300" : "bg-blue-400 border-blue-300")} style={{ left: `${pct}%`, marginLeft: "-5px" }} title={`Consegna ${format(parseISO(d.scheduled_date), "d MMM yyyy", { locale: it })} — ${d.quantity} pz`} />
                                    );
                                  })}
                                </div>
                              </div>

                              {isPoExpanded && (
                                <div className="bg-muted/10 px-10 py-3 space-y-3">
                                  <div className="grid grid-cols-4 gap-2 text-xs">
                                    <div className="bg-background/50 rounded p-2">
                                      <span className="text-muted-foreground text-[10px] font-mono uppercase block">Data Ordine</span>
                                      <span className="font-mono text-foreground">{po.order_date ? format(parseISO(po.order_date), "d MMM yyyy", { locale: it }) : "—"}</span>
                                    </div>
                                    <div className="bg-background/50 rounded p-2">
                                      <span className="text-muted-foreground text-[10px] font-mono uppercase block">Consegna Rich.</span>
                                      <span className="font-mono text-foreground">{po.requested_delivery_date ? format(parseISO(po.requested_delivery_date), "d MMM yyyy", { locale: it }) : "—"}</span>
                                    </div>
                                    <div className="bg-background/50 rounded p-2">
                                      <span className="text-muted-foreground text-[10px] font-mono uppercase block">Consegna Eff.</span>
                                      <span className="font-mono text-foreground">{po.actual_delivery_date ? format(parseISO(po.actual_delivery_date), "d MMM yyyy", { locale: it }) : "In attesa"}</span>
                                    </div>
                                    <div className="bg-background/50 rounded p-2">
                                      <span className="text-muted-foreground text-[10px] font-mono uppercase block">Lead Time</span>
                                      <span className="font-mono text-foreground">{lt !== null ? `${lt} giorni` : "—"}</span>
                                    </div>
                                  </div>
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
                                              <span className="font-mono text-foreground">{format(parseISO(d.scheduled_date), "d MMM yyyy", { locale: it })}</span>
                                              {d.actual_delivery_date && (
                                                <span className="font-mono text-emerald-400 flex items-center gap-1">
                                                  <Check className="h-3 w-3" /> {format(parseISO(d.actual_delivery_date), "d MMM yyyy", { locale: it })}
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

                        {productWOs.map(wo => {
                          const startDate = wo.actual_start || wo.planned_start;
                          const endDate = wo.actual_end || wo.planned_end;
                          const prodDays = startDate && endDate ? differenceInDays(parseISO(endDate), parseISO(startDate)) : null;
                          const woColor = WO_BAR_COLORS[wo.status] ?? "bg-violet-500/40 border-violet-500/30";

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
                                {renderBar(startDate, endDate, cn("border", woColor), wo.wo_number)}
                              </div>
                            </div>
                          );
                        })}

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
              {unassignedPOs.length > 0 && productFilter === "__all__" && (
                <div className="border-b border-border/40">
                  <div className="flex hover:bg-muted/10 cursor-pointer transition-colors" onClick={() => toggleProduct("__unassigned__")}>
                    <div className="w-72 shrink-0 border-r border-border/30 px-3 py-3">
                      <div className="flex items-center gap-2">
                        {expandedProducts.has("__unassigned__") ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-sm text-muted-foreground font-medium">Ordini non assegnati</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5">{unassignedPOs.length}</Badge>
                      </div>
                    </div>
                    <div className="flex-1 relative h-10 overflow-hidden"><GridLines /></div>
                  </div>
                  {expandedProducts.has("__unassigned__") && (
                    <div className="bg-muted/5">
                      {unassignedPOs.map(po => {
                        const supplier = getSupplier(po.supplier_id);
                        const poColor = PO_BAR_COLORS[po.status] ?? PO_BAR_COLORS.draft;
                        return (
                          <div key={po.id} className="flex border-b border-border/10 last:border-0 hover:bg-muted/10 transition-colors">
                            <div className="w-72 shrink-0 border-r border-border/20 px-3 py-2 pl-10">
                              <div className="flex items-center gap-2">
                                <Truck className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                <span className="font-mono text-xs text-foreground/80">{po.po_number}</span>
                                <Badge className={cn("text-[9px] h-4 px-1.5", poColor)}>{PO_STATUS_LABELS[po.status]}</Badge>
                              </div>
                              <div className="text-[10px] text-muted-foreground ml-5">{supplier?.company_name || "—"}</div>
                            </div>
                            <div className="flex-1 relative h-10 overflow-hidden">
                              <GridLines />
                              {renderBar(po.order_date, po.actual_delivery_date || po.requested_delivery_date, cn("border", poColor), po.po_number)}
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
