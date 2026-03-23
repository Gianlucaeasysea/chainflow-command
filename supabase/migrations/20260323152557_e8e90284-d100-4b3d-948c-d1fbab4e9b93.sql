
ALTER TABLE public.purchase_orders 
  ADD COLUMN IF NOT EXISTS actual_delivery_date date,
  ADD COLUMN IF NOT EXISTS order_date date DEFAULT CURRENT_DATE;

ALTER TABLE public.po_lines
  ADD COLUMN IF NOT EXISTS supplier_item_id uuid REFERENCES public.supplier_items(id);
