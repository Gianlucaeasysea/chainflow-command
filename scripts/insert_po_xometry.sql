-- ============================================================
-- INSERT PO XOMETRY - ES01 Components + FPMAX01-01
-- Fornitore: XOMETRY | Prodotto: FS-101-1
-- 4 consegne: 20/01/2026, 20/04/2026, 20/07/2026, 20/10/2026
-- Esegui nel Supabase SQL Editor
-- ============================================================

DO $$
DECLARE
  v_supplier_id   uuid;
  v_product_id    uuid;
  v_po_id         uuid;

  -- Item IDs
  id_es0101  uuid; id_es0102  uuid; id_es0103  uuid; id_es0104  uuid;
  id_es0105  uuid; id_es0107  uuid; id_es0109  uuid; id_es0111  uuid;
  id_es0112  uuid; id_es0113  uuid; id_es0119  uuid; id_fpmax   uuid;

  -- PO Line IDs
  l_es0101  uuid; l_es0102  uuid; l_es0103  uuid; l_es0104  uuid;
  l_es0105  uuid; l_es0107  uuid; l_es0109  uuid; l_es0111  uuid;
  l_es0112  uuid; l_es0113  uuid; l_es0119  uuid; l_fpmax   uuid;

  -- Delivery group IDs
  g1 uuid := gen_random_uuid();
  g2 uuid := gen_random_uuid();
  g3 uuid := gen_random_uuid();
  g4 uuid := gen_random_uuid();

BEGIN

  -- 1. Trova fornitore XOMETRY
  SELECT id INTO v_supplier_id FROM suppliers
  WHERE LOWER(company_name) ILIKE '%xometry%' LIMIT 1;

  IF v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Fornitore XOMETRY non trovato';
  END IF;

  -- 2. Trova prodotto finito FS-101-1
  SELECT id INTO v_product_id FROM items
  WHERE item_code = 'FS-101-1' LIMIT 1;

  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Prodotto FS-101-1 non trovato';
  END IF;

  -- 3. Trova tutti i componenti
  SELECT id INTO id_es0101 FROM items WHERE item_code = 'ES01-01';
  SELECT id INTO id_es0102 FROM items WHERE item_code = 'ES01-02';
  SELECT id INTO id_es0103 FROM items WHERE item_code = 'ES01-03';
  SELECT id INTO id_es0104 FROM items WHERE item_code = 'ES01-04';
  SELECT id INTO id_es0105 FROM items WHERE item_code = 'ES01-05';
  SELECT id INTO id_es0107 FROM items WHERE item_code = 'ES01-07';
  SELECT id INTO id_es0109 FROM items WHERE item_code = 'ES01-09';
  SELECT id INTO id_es0111 FROM items WHERE item_code = 'ES01-11';
  SELECT id INTO id_es0112 FROM items WHERE item_code = 'ES01-12';
  SELECT id INTO id_es0113 FROM items WHERE item_code = 'ES01-13';
  SELECT id INTO id_es0119 FROM items WHERE item_code = 'ES01-19';
  SELECT id INTO id_fpmax  FROM items WHERE item_code = 'FPMAX01-01';

  -- 4. Crea Purchase Order
  INSERT INTO purchase_orders (
    po_number, supplier_id, product_item_id,
    status, order_date, requested_delivery_date,
    currency, total_amount, notes
  ) VALUES (
    'PO-XOM-2026-001',
    v_supplier_id,
    v_product_id,
    'confirmed',
    '2026-01-15',
    '2026-10-20',
    'EUR',
    -- Total: somma di tutti i valori delle 4 consegne
    (8402.13 + 4210.38 + 13200.59 + 11281.01 + 5700.78 +
     1285.47 + 1993.41 + 4211.51 + 2161.08 + 2404.13 +
     372.60 + 3393.60),
    'Ordine componenti ES01 e FPMAX01-01 per produzione FS-101-1. 4 consegne scaglionate 2026.'
  )
  RETURNING id INTO v_po_id;

  RAISE NOTICE 'PO creato con ID: %', v_po_id;

  -- 5. Inserisci PO Lines (quantità totali)
  -- ES01-01: tot 1863 @ €4.51
  INSERT INTO po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
  VALUES (v_po_id, id_es0101, 1863, 4.51, 8402.13, 1) RETURNING id INTO l_es0101;

  -- ES01-02: tot 1863 @ €2.26
  INSERT INTO po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
  VALUES (v_po_id, id_es0102, 1863, 2.26, 4210.38, 2) RETURNING id INTO l_es0102;

  -- ES01-03: tot 1391 @ €9.49
  INSERT INTO po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
  VALUES (v_po_id, id_es0103, 1391, 9.49, 13200.59, 3) RETURNING id INTO l_es0103;

  -- ES01-04: tot 1391 @ €8.11
  INSERT INTO po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
  VALUES (v_po_id, id_es0104, 1391, 8.11, 11281.01, 4) RETURNING id INTO l_es0104;

  -- ES01-05: tot 1863 @ €3.06
  INSERT INTO po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
  VALUES (v_po_id, id_es0105, 1863, 3.06, 5700.78, 5) RETURNING id INTO l_es0105;

  -- ES01-07: tot 1863 @ €0.69
  INSERT INTO po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
  VALUES (v_po_id, id_es0107, 1863, 0.69, 1285.47, 6) RETURNING id INTO l_es0107;

  -- ES01-09: tot 1863 @ €1.07
  INSERT INTO po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
  VALUES (v_po_id, id_es0109, 1863, 1.07, 1993.41, 7) RETURNING id INTO l_es0109;

  -- ES01-11: tot 3727 @ €1.13
  INSERT INTO po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
  VALUES (v_po_id, id_es0111, 3727, 1.13, 4211.51, 8) RETURNING id INTO l_es0111;

  -- ES01-12: tot 1863 @ €1.16
  INSERT INTO po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
  VALUES (v_po_id, id_es0112, 1863, 1.16, 2161.08, 9) RETURNING id INTO l_es0112;

  -- ES01-13: tot 5591 @ €0.43
  INSERT INTO po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
  VALUES (v_po_id, id_es0113, 5591, 0.43, 2404.13, 10) RETURNING id INTO l_es0113;

  -- ES01-19: tot 1863 @ €0.20
  INSERT INTO po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
  VALUES (v_po_id, id_es0119, 1863, 0.20, 372.60, 11) RETURNING id INTO l_es0119;

  -- FPMAX01-01: tot 450 @ €10.10
  INSERT INTO po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
  VALUES (v_po_id, id_fpmax, 450, 10.10, 3393.60, 12) RETURNING id INTO l_fpmax;

  RAISE NOTICE '12 righe PO inserite';

  -- 6. Inserisci Consegne
  -- ===== CONSEGNA 1 - 20/01/2026 =====
  -- (FPMAX01-01 ha qty=0 in D1, si salta)
  INSERT INTO po_deliveries (purchase_order_id, po_line_id, delivery_group_id, scheduled_date, quantity, status, destination)
  VALUES
    (v_po_id, l_es0101, g1, '2026-01-20', 415,  'scheduled', NULL),
    (v_po_id, l_es0102, g1, '2026-01-20', 415,  'scheduled', NULL),
    (v_po_id, l_es0103, g1, '2026-01-20', 279,  'scheduled', NULL),
    (v_po_id, l_es0104, g1, '2026-01-20', 279,  'scheduled', NULL),
    (v_po_id, l_es0105, g1, '2026-01-20', 415,  'scheduled', NULL),
    (v_po_id, l_es0107, g1, '2026-01-20', 415,  'scheduled', NULL),
    (v_po_id, l_es0109, g1, '2026-01-20', 415,  'scheduled', NULL),
    (v_po_id, l_es0111, g1, '2026-01-20', 830,  'scheduled', NULL),
    (v_po_id, l_es0112, g1, '2026-01-20', 415,  'scheduled', NULL),
    (v_po_id, l_es0113, g1, '2026-01-20', 1244, 'scheduled', NULL),
    (v_po_id, l_es0119, g1, '2026-01-20', 415,  'scheduled', NULL);

  -- ===== CONSEGNA 2 - 20/04/2026 =====
  INSERT INTO po_deliveries (purchase_order_id, po_line_id, delivery_group_id, scheduled_date, quantity, status, destination)
  VALUES
    (v_po_id, l_es0101, g2, '2026-04-20', 603,  'scheduled', NULL),
    (v_po_id, l_es0102, g2, '2026-04-20', 603,  'scheduled', NULL),
    (v_po_id, l_es0103, g2, '2026-04-20', 466,  'scheduled', NULL),
    (v_po_id, l_es0104, g2, '2026-04-20', 466,  'scheduled', NULL),
    (v_po_id, l_es0105, g2, '2026-04-20', 603,  'scheduled', NULL),
    (v_po_id, l_es0107, g2, '2026-04-20', 603,  'scheduled', NULL),
    (v_po_id, l_es0109, g2, '2026-04-20', 603,  'scheduled', NULL),
    (v_po_id, l_es0111, g2, '2026-04-20', 1207, 'scheduled', NULL),
    (v_po_id, l_es0112, g2, '2026-04-20', 603,  'scheduled', NULL),
    (v_po_id, l_es0113, g2, '2026-04-20', 1811, 'scheduled', NULL),
    (v_po_id, l_es0119, g2, '2026-04-20', 603,  'scheduled', NULL),
    (v_po_id, l_fpmax,  g2, '2026-04-20', 184,  'scheduled', NULL);

  -- ===== CONSEGNA 3 - 20/07/2026 =====
  INSERT INTO po_deliveries (purchase_order_id, po_line_id, delivery_group_id, scheduled_date, quantity, status, destination)
  VALUES
    (v_po_id, l_es0101, g3, '2026-07-20', 410,  'scheduled', NULL),
    (v_po_id, l_es0102, g3, '2026-07-20', 410,  'scheduled', NULL),
    (v_po_id, l_es0103, g3, '2026-07-20', 303,  'scheduled', NULL),
    (v_po_id, l_es0104, g3, '2026-07-20', 303,  'scheduled', NULL),
    (v_po_id, l_es0105, g3, '2026-07-20', 410,  'scheduled', NULL),
    (v_po_id, l_es0107, g3, '2026-07-20', 410,  'scheduled', NULL),
    (v_po_id, l_es0109, g3, '2026-07-20', 410,  'scheduled', NULL),
    (v_po_id, l_es0111, g3, '2026-07-20', 821,  'scheduled', NULL),
    (v_po_id, l_es0112, g3, '2026-07-20', 410,  'scheduled', NULL),
    (v_po_id, l_es0113, g3, '2026-07-20', 1232, 'scheduled', NULL),
    (v_po_id, l_es0119, g3, '2026-07-20', 410,  'scheduled', NULL),
    (v_po_id, l_fpmax,  g3, '2026-07-20', 144,  'scheduled', NULL);

  -- ===== CONSEGNA 4 - 20/10/2026 =====
  INSERT INTO po_deliveries (purchase_order_id, po_line_id, delivery_group_id, scheduled_date, quantity, status, destination)
  VALUES
    (v_po_id, l_es0101, g4, '2026-10-20', 435,  'scheduled', NULL),
    (v_po_id, l_es0102, g4, '2026-10-20', 435,  'scheduled', NULL),
    (v_po_id, l_es0103, g4, '2026-10-20', 343,  'scheduled', NULL),
    (v_po_id, l_es0104, g4, '2026-10-20', 343,  'scheduled', NULL),
    (v_po_id, l_es0105, g4, '2026-10-20', 435,  'scheduled', NULL),
    (v_po_id, l_es0107, g4, '2026-10-20', 435,  'scheduled', NULL),
    (v_po_id, l_es0109, g4, '2026-10-20', 435,  'scheduled', NULL),
    (v_po_id, l_es0111, g4, '2026-10-20', 869,  'scheduled', NULL),
    (v_po_id, l_es0112, g4, '2026-10-20', 435,  'scheduled', NULL),
    (v_po_id, l_es0113, g4, '2026-10-20', 1304, 'scheduled', NULL),
    (v_po_id, l_es0119, g4, '2026-10-20', 435,  'scheduled', NULL),
    (v_po_id, l_fpmax,  g4, '2026-10-20', 122,  'scheduled', NULL);

  RAISE NOTICE 'Tutte le consegne inserite (4 gruppi, 47 righe)';
  RAISE NOTICE 'PO ID: % | PO Number: PO-XOM-2026-001', v_po_id;
  RAISE NOTICE 'Prodotto finito linkato: FS-101-1 (ID: %)', v_product_id;
  RAISE NOTICE 'Totale ordine: € 58,416.69';

END $$;
