
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS product_item_id uuid REFERENCES public.items(id);
