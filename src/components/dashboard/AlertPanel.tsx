import { AlertTriangle, Clock, Package, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: "overdue" | "stockout" | "expiring" | "certification";
  message: string;
  severity: "warning" | "critical";
}

const iconMap = {
  overdue: Clock,
  stockout: Package,
  expiring: AlertTriangle,
  certification: ShieldAlert,
};

// Demo alerts
const demoAlerts: Alert[] = [
  { id: "1", type: "overdue", message: "PO-2024-0045 scaduto da 3 giorni — Fornitore: MetalTech Srl", severity: "critical" },
  { id: "2", type: "stockout", message: "Rischio stockout: Vite M8x30 — scorta residua 2 giorni", severity: "critical" },
  { id: "3", type: "expiring", message: "Lotto L-2024-0123 in scadenza fra 15 giorni", severity: "warning" },
  { id: "4", type: "certification", message: "ISO 9001 di TechSupply SpA scade fra 28 giorni", severity: "warning" },
];

export function AlertPanel() {
  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-status-warning" />
          Alert Attivi
          <span className="ml-auto bg-status-critical/20 text-status-critical text-xs font-mono px-2 py-0.5 rounded">
            {demoAlerts.length}
          </span>
        </h3>
      </div>
      <div className="divide-y divide-border">
        {demoAlerts.map((alert) => {
          const Icon = iconMap[alert.type];
          return (
            <div key={alert.id} className="p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors cursor-pointer">
              <Icon
                className={cn(
                  "h-4 w-4 mt-0.5 shrink-0",
                  alert.severity === "critical" ? "text-status-critical" : "text-status-warning"
                )}
              />
              <p className="text-xs text-foreground/80 leading-relaxed">{alert.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
