
ALTER TABLE public.po_deliveries 
ADD COLUMN IF NOT EXISTS delivery_group_id uuid,
ADD COLUMN IF NOT EXISTS destination text,
ADD COLUMN IF NOT EXISTS actual_delivery_date date;
