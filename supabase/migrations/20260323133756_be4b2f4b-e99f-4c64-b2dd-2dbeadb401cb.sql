
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS drive_folder_url text;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS technical_file_urls text[] DEFAULT '{}';
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'component';
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS assembly_cost numeric DEFAULT 0;
