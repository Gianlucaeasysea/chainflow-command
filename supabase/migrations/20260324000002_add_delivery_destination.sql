-- Aggiungi destinazione e raggruppamento consegne
ALTER TABLE po_deliveries ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE po_deliveries ADD COLUMN IF NOT EXISTS delivery_group_id UUID;
