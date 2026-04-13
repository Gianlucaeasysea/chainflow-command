import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon: Icon, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">{actionLabel}</Button>
      )}
    </div>
  );
}
