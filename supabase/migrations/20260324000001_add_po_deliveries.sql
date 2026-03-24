-- po_deliveries: split delivery scheduling for purchase orders
CREATE TABLE po_deliveries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  po_line_id          UUID REFERENCES po_lines(id) ON DELETE SET NULL,
  scheduled_date      DATE NOT NULL,
  quantity            NUMERIC(15,4) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'in_transit', 'received', 'delayed')),
  notes               TEXT,
  actual_date         DATE,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE po_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_po_deliveries" ON po_deliveries
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TRIGGER update_po_deliveries_updated_at
  BEFORE UPDATE ON po_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
