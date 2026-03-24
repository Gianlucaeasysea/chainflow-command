CREATE TABLE public.po_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  po_line_id uuid REFERENCES public.po_lines(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.po_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_deliveries select anon" ON public.po_deliveries FOR SELECT TO anon USING (true);
CREATE POLICY "po_deliveries insert anon" ON public.po_deliveries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "po_deliveries update anon" ON public.po_deliveries FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "po_deliveries delete anon" ON public.po_deliveries FOR DELETE TO anon USING (true);