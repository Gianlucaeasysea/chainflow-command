
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ITEMS table
CREATE TABLE public.items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  unit_of_measure TEXT NOT NULL DEFAULT 'PZ',
  category TEXT,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Items are viewable by authenticated users" ON public.items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Items can be created by authenticated users" ON public.items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Items can be updated by authenticated users" ON public.items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Items can be deleted by authenticated users" ON public.items FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_items_code ON public.items(item_code);
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SUPPLIERS table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  vat_number TEXT,
  country TEXT,
  address TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_role TEXT,
  rating NUMERIC(2,1) CHECK (rating >= 0 AND rating <= 5),
  payment_terms TEXT DEFAULT '30gg',
  currency TEXT DEFAULT 'EUR',
  incoterm TEXT DEFAULT 'EXW',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suppliers viewable by authenticated" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Suppliers insertable by authenticated" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Suppliers updatable by authenticated" ON public.suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Suppliers deletable by authenticated" ON public.suppliers FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_suppliers_name ON public.suppliers(company_name);
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SUPPLIER_ITEMS
CREATE TABLE public.supplier_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  supplier_item_code TEXT,
  unit_price NUMERIC(12,4),
  currency TEXT DEFAULT 'EUR',
  moq INTEGER DEFAULT 1,
  order_multiple INTEGER DEFAULT 1,
  lead_time_days INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, item_id)
);
ALTER TABLE public.supplier_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supplier items viewable" ON public.supplier_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supplier items insertable" ON public.supplier_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Supplier items updatable" ON public.supplier_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Supplier items deletable" ON public.supplier_items FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_supplier_items_updated_at BEFORE UPDATE ON public.supplier_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SUPPLIER_CERTIFICATIONS
CREATE TABLE public.supplier_certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  certification_name TEXT NOT NULL,
  issued_date DATE,
  expiry_date DATE,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Certs viewable" ON public.supplier_certifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Certs insertable" ON public.supplier_certifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Certs updatable" ON public.supplier_certifications FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Certs deletable" ON public.supplier_certifications FOR DELETE TO authenticated USING (true);

-- BOM_HEADERS
CREATE TABLE public.bom_headers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','obsolete')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, version)
);
ALTER TABLE public.bom_headers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "BOM headers viewable" ON public.bom_headers FOR SELECT TO authenticated USING (true);
CREATE POLICY "BOM headers insertable" ON public.bom_headers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "BOM headers updatable" ON public.bom_headers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "BOM headers deletable" ON public.bom_headers FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_bom_headers_updated_at BEFORE UPDATE ON public.bom_headers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BOM_LINES
CREATE TABLE public.bom_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_header_id UUID NOT NULL REFERENCES public.bom_headers(id) ON DELETE CASCADE,
  component_item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,4) NOT NULL DEFAULT 1,
  waste_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bom_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "BOM lines viewable" ON public.bom_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "BOM lines insertable" ON public.bom_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "BOM lines updatable" ON public.bom_lines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "BOM lines deletable" ON public.bom_lines FOR DELETE TO authenticated USING (true);

-- PURCHASE_ORDERS
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','confirmed','in_production','shipping','customs','delivered','closed','cancelled')),
  currency TEXT DEFAULT 'EUR',
  incoterm TEXT,
  shipping_port TEXT,
  requested_delivery_date DATE,
  total_amount NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PO viewable" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "PO insertable" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "PO updatable" ON public.purchase_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "PO deletable" ON public.purchase_orders FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_po_number ON public.purchase_orders(po_number);
CREATE INDEX idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE TRIGGER update_po_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PO_LINES
CREATE TABLE public.po_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id),
  quantity NUMERIC(12,4) NOT NULL,
  unit_price NUMERIC(12,4) NOT NULL,
  discount_pct NUMERIC(5,2) DEFAULT 0,
  line_total NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price * (1 - discount_pct / 100)) STORED,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.po_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PO lines viewable" ON public.po_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "PO lines insertable" ON public.po_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "PO lines updatable" ON public.po_lines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "PO lines deletable" ON public.po_lines FOR DELETE TO authenticated USING (true);

-- PO_STATUS_HISTORY
CREATE TABLE public.po_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.po_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PO history viewable" ON public.po_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "PO history insertable" ON public.po_status_history FOR INSERT TO authenticated WITH CHECK (true);

-- STOCK_MOVEMENTS
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('inbound_po','outbound_wo','adjustment','return_supplier','return_customer','transfer')),
  quantity NUMERIC(12,4) NOT NULL,
  lot_number TEXT,
  reference_id UUID,
  reference_type TEXT,
  warehouse TEXT DEFAULT 'MAIN',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock movements viewable" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Stock movements insertable" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (true);

-- INVENTORY_LOTS
CREATE TABLE public.inventory_lots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id),
  lot_number TEXT NOT NULL,
  supplier_lot_number TEXT,
  quantity_on_hand NUMERIC(12,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'quarantine' CHECK (status IN ('quarantine','approved','rejected','in_use','exhausted')),
  production_date DATE,
  expiry_date DATE,
  coa_url TEXT,
  purchase_order_id UUID REFERENCES public.purchase_orders(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lots viewable" ON public.inventory_lots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lots insertable" ON public.inventory_lots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Lots updatable" ON public.inventory_lots FOR UPDATE TO authenticated USING (true);
CREATE INDEX idx_lots_number ON public.inventory_lots(lot_number);
CREATE INDEX idx_lots_item ON public.inventory_lots(item_id);
CREATE TRIGGER update_lots_updated_at BEFORE UPDATE ON public.inventory_lots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRODUCTION_ORDERS
CREATE TABLE public.production_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wo_number TEXT NOT NULL UNIQUE,
  product_item_id UUID NOT NULL REFERENCES public.items(id),
  bom_header_id UUID REFERENCES public.bom_headers(id),
  quantity_to_produce NUMERIC(12,4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','materials_allocated','in_progress','quality_check','completed','closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  planned_start DATE,
  planned_end DATE,
  actual_start DATE,
  actual_end DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "WO viewable" ON public.production_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "WO insertable" ON public.production_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "WO updatable" ON public.production_orders FOR UPDATE TO authenticated USING (true);
CREATE INDEX idx_wo_number ON public.production_orders(wo_number);
CREATE TRIGGER update_wo_updated_at BEFORE UPDATE ON public.production_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- REORDER_PARAMS
CREATE TABLE public.reorder_params (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE UNIQUE,
  reorder_point NUMERIC(12,4),
  safety_stock NUMERIC(12,4),
  eoq NUMERIC(12,4),
  max_stock NUMERIC(12,4),
  management_type TEXT DEFAULT 'reorder_point' CHECK (management_type IN ('mrp','reorder_point','jit','make_to_order')),
  service_level NUMERIC(5,2) DEFAULT 95.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reorder_params ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reorder viewable" ON public.reorder_params FOR SELECT TO authenticated USING (true);
CREATE POLICY "Reorder insertable" ON public.reorder_params FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Reorder updatable" ON public.reorder_params FOR UPDATE TO authenticated USING (true);
CREATE TRIGGER update_reorder_updated_at BEFORE UPDATE ON public.reorder_params FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- COST_HISTORY
CREATE TABLE public.cost_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL CHECK (cost_type IN ('standard','actual')),
  amount NUMERIC(12,4) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  source TEXT,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cost_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cost history viewable" ON public.cost_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cost history insertable" ON public.cost_history FOR INSERT TO authenticated WITH CHECK (true);
