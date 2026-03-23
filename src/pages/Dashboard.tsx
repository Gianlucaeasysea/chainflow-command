import { Warehouse, FileText, Factory, Package, AlertTriangle, Users } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { PurchaseChart } from "@/components/dashboard/PurchaseChart";
import { TopSuppliersChart } from "@/components/dashboard/TopSuppliersChart";
import { QuickActions } from "@/components/dashboard/QuickActions";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Panoramica supply chain in tempo reale</p>
        </div>
        <QuickActions />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Valore Stock"
          value="€1.24M"
          icon={Warehouse}
          trend={{ value: 3.2, label: "vs mese prec." }}
          subtitle="vs mese prec."
        />
        <KpiCard
          title="PO Aperti"
          value="23"
          icon={FileText}
          subtitle="€185k in transito"
        />
        <KpiCard
          title="WO Attivi"
          value="8"
          icon={Factory}
          subtitle="3 in lavorazione"
        />
        <KpiCard
          title="Sotto ROP"
          value="12"
          icon={Package}
          variant="warning"
          subtitle="articoli da riordinare"
        />
        <KpiCard
          title="Lotti Scadenza"
          value="5"
          icon={AlertTriangle}
          variant="critical"
          subtitle="entro 30 giorni"
        />
        <KpiCard
          title="Fornitori < 3★"
          value="4"
          icon={Users}
          variant="warning"
          subtitle="da valutare"
        />
      </div>

      {/* Charts + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <PurchaseChart />
          <TopSuppliersChart />
        </div>
        <AlertPanel />
      </div>
    </div>
  );
}
