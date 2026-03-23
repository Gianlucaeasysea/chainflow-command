import { Plus, FileText, Factory, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: "Nuovo PO", icon: FileText, onClick: () => navigate("/purchase-orders") },
    { label: "Nuovo WO", icon: Factory, onClick: () => navigate("/production-orders") },
    { label: "Movimento", icon: ArrowUpDown, onClick: () => navigate("/inventory") },
    { label: "Nuovo Fornitore", icon: Plus, onClick: () => navigate("/suppliers") },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          className="gap-2 font-mono text-xs"
          onClick={action.onClick}
        >
          <action.icon className="h-3.5 w-3.5" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}
