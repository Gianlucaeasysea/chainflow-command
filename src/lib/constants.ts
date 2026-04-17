// Costanti condivise — usa SOLO queste in tutto il progetto.

// Tipi movimenti stock che AUMENTANO il magazzino
export const POSITIVE_MOVEMENT_TYPES = [
  "po_inbound",
  "adjustment_in",
  "customer_return",
  "wo_finish", // prodotto finito da ODP completato
] as const;

// Tipi movimenti stock che DIMINUISCONO il magazzino
export const NEGATIVE_MOVEMENT_TYPES = [
  "wo_output", // componenti allocati a ODP
  "adjustment_out",
  "customer_shipment",
] as const;

// Status ODP considerati "attivi"
export const ACTIVE_WO_STATUSES = [
  "planned",
  "materials_allocated",
  "in_progress",
  "quality_check",
] as const;

// Etichette UI per status ODP
export const WO_STATUS_LABELS: Record<string, string> = {
  planned: "Pianificato",
  materials_allocated: "Materiali Allocati",
  in_progress: "In Lavorazione",
  quality_check: "Controllo Qualità",
  completed: "Completato",
  closed: "Chiuso",
};
