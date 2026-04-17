-- Create wo_status_history table for production orders audit trail
CREATE TABLE IF NOT EXISTS public.wo_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id uuid NOT NULL,
  status text NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_status_history_po ON public.wo_status_history(production_order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_po_status_history_po ON public.po_status_history(purchase_order_id, created_at);

ALTER TABLE public.wo_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WO history viewable" ON public.wo_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "WO history viewable by anon" ON public.wo_status_history FOR SELECT TO anon USING (true);
CREATE POLICY "WO history insertable" ON public.wo_status_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "WO history insertable by anon" ON public.wo_status_history FOR INSERT TO anon WITH CHECK (true);

-- Backfill: insert initial status row for any PO that has no history yet
INSERT INTO public.po_status_history (purchase_order_id, status, notes, created_at)
SELECT id, status, 'Migrazione: stato iniziale', created_at
FROM public.purchase_orders
WHERE id NOT IN (SELECT DISTINCT purchase_order_id FROM public.po_status_history);

-- Backfill: same for production orders
INSERT INTO public.wo_status_history (production_order_id, status, notes, created_at)
SELECT id, status, 'Migrazione: stato iniziale', created_at
FROM public.production_orders;