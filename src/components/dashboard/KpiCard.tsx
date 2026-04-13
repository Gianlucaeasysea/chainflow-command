import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number | React.ReactNode;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  variant?: "default" | "warning" | "critical";
}

export function KpiCard({ title, value, subtitle, icon: Icon, trend, variant = "default" }: KpiCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs uppercase tracking-wider font-mono">{title}</span>
        <Icon
          className={cn(
            "h-4 w-4",
            variant === "warning" && "text-status-warning",
            variant === "critical" && "text-status-critical",
            variant === "default" && "text-primary"
          )}
        />
      </div>
      <div className="kpi-value text-foreground">{value}</div>
      <div className="flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              "text-xs font-mono",
              trend.value >= 0 ? "text-status-ok" : "text-status-critical"
            )}
          >
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
        )}
        {subtitle && <span className="text-muted-foreground text-xs">{subtitle}</span>}
      </div>
    </div>
  );
}
