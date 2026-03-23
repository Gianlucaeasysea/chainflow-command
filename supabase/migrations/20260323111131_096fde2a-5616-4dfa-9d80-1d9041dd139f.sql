
-- Allow anonymous access to all tables since no auth is implemented yet

-- items
CREATE POLICY "Items viewable by anon" ON public.items FOR SELECT TO anon USING (true);
CREATE POLICY "Items insertable by anon" ON public.items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Items updatable by anon" ON public.items FOR UPDATE TO anon USING (true);
CREATE POLICY "Items deletable by anon" ON public.items FOR DELETE TO anon USING (true);

-- suppliers
CREATE POLICY "Suppliers viewable by anon" ON public.suppliers FOR SELECT TO anon USING (true);
CREATE POLICY "Suppliers insertable by anon" ON public.suppliers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Suppliers updatable by anon" ON public.suppliers FOR UPDATE TO anon USING (true);
CREATE POLICY "Suppliers deletable by anon" ON public.suppliers FOR DELETE TO anon USING (true);

-- bom_headers
CREATE POLICY "BOM headers viewable by anon" ON public.bom_headers FOR SELECT TO anon USING (true);
CREATE POLICY "BOM headers insertable by anon" ON public.bom_headers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "BOM headers updatable by anon" ON public.bom_headers FOR UPDATE TO anon USING (true);
CREATE POLICY "BOM headers deletable by anon" ON public.bom_headers FOR DELETE TO anon USING (true);

-- bom_lines
CREATE POLICY "BOM lines viewable by anon" ON public.bom_lines FOR SELECT TO anon USING (true);
CREATE POLICY "BOM lines insertable by anon" ON public.bom_lines FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "BOM lines updatable by anon" ON public.bom_lines FOR UPDATE TO anon USING (true);
CREATE POLICY "BOM lines deletable by anon" ON public.bom_lines FOR DELETE TO anon USING (true);

-- purchase_orders
CREATE POLICY "PO viewable by anon" ON public.purchase_orders FOR SELECT TO anon USING (true);
CREATE POLICY "PO insertable by anon" ON public.purchase_orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "PO updatable by anon" ON public.purchase_orders FOR UPDATE TO anon USING (true);
CREATE POLICY "PO deletable by anon" ON public.purchase_orders FOR DELETE TO anon USING (true);

-- po_lines
CREATE POLICY "PO lines viewable by anon" ON public.po_lines FOR SELECT TO anon USING (true);
CREATE POLICY "PO lines insertable by anon" ON public.po_lines FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "PO lines updatable by anon" ON public.po_lines FOR UPDATE TO anon USING (true);
CREATE POLICY "PO lines deletable by anon" ON public.po_lines FOR DELETE TO anon USING (true);

-- po_status_history
CREATE POLICY "PO history viewable by anon" ON public.po_status_history FOR SELECT TO anon USING (true);
CREATE POLICY "PO history insertable by anon" ON public.po_status_history FOR INSERT TO anon WITH CHECK (true);

-- production_orders
CREATE POLICY "WO viewable by anon" ON public.production_orders FOR SELECT TO anon USING (true);
CREATE POLICY "WO insertable by anon" ON public.production_orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "WO updatable by anon" ON public.production_orders FOR UPDATE TO anon USING (true);

-- stock_movements
CREATE POLICY "Stock movements viewable by anon" ON public.stock_movements FOR SELECT TO anon USING (true);
CREATE POLICY "Stock movements insertable by anon" ON public.stock_movements FOR INSERT TO anon WITH CHECK (true);

-- inventory_lots
CREATE POLICY "Lots viewable by anon" ON public.inventory_lots FOR SELECT TO anon USING (true);
CREATE POLICY "Lots insertable by anon" ON public.inventory_lots FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Lots updatable by anon" ON public.inventory_lots FOR UPDATE TO anon USING (true);

-- cost_history
CREATE POLICY "Cost history viewable by anon" ON public.cost_history FOR SELECT TO anon USING (true);
CREATE POLICY "Cost history insertable by anon" ON public.cost_history FOR INSERT TO anon WITH CHECK (true);

-- reorder_params
CREATE POLICY "Reorder viewable by anon" ON public.reorder_params FOR SELECT TO anon USING (true);
CREATE POLICY "Reorder insertable by anon" ON public.reorder_params FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Reorder updatable by anon" ON public.reorder_params FOR UPDATE TO anon USING (true);

-- supplier_items
CREATE POLICY "Supplier items viewable by anon" ON public.supplier_items FOR SELECT TO anon USING (true);
CREATE POLICY "Supplier items insertable by anon" ON public.supplier_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Supplier items updatable by anon" ON public.supplier_items FOR UPDATE TO anon USING (true);
CREATE POLICY "Supplier items deletable by anon" ON public.supplier_items FOR DELETE TO anon USING (true);

-- supplier_certifications
CREATE POLICY "Certs viewable by anon" ON public.supplier_certifications FOR SELECT TO anon USING (true);
CREATE POLICY "Certs insertable by anon" ON public.supplier_certifications FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Certs updatable by anon" ON public.supplier_certifications FOR UPDATE TO anon USING (true);
CREATE POLICY "Certs deletable by anon" ON public.supplier_certifications FOR DELETE TO anon USING (true);
