-- Insert PO XOMETRY: componenti ES01 + FPMAX01-01 per prodotto FS-101-1
-- 4 consegne: 20/01/2026, 20/04/2026, 20/07/2026, 20/10/2026

DO $$
DECLARE
  v_supplier_id   uuid;
  v_product_id    uuid;
  v_po_id         uuid;

  id_es0101 uuid; id_es0102 uuid; id_es0103 uuid; id_es0104 uuid;
  id_es0105 uuid; id_es0107 uuid; id_es0109 uuid; id_es0111 uuid;
  id_es0112 uuid; id_es0113 uuid; id_es0119 uuid; id_fpmax  uuid;

  l_es0101 uuid; l_es0102 uuid; l_es0103 uuid; l_es0104 uuid;
  l_es0105 uuid; l_es0107 uuid; l_es0109 uuid; l_es0111 uuid;
  l_es0112 uuid; l_es0113 uuid; l_es0119 uuid; l_fpmax  uuid;

  g1 uuid := gen_random_uuid();
  g2 uuid := gen_random_uuid();
  g3 uuid := gen_random_uuid();
  g4 uuid := gen_random_uuid();

BEGIN
  -- Verifica non esista già
  IF EXISTS (SELECT 1 FROM public.purchase_orders WHERE po_number = 'PO-XOM-2026-001') THEN
    RAISE NOTICE 'PO-XOM-2026-001 già presente, skip.';
    RETURN;
  END IF;

  SELECT id INTO v_supplier_id FROM public.suppliers
    WHERE company_name ILIKE '%xometry%' LIMIT 1;
  IF v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Fornitore XOMETRY non trovato';
  END IF;

  SELECT id INTO v_product_id FROM public.items
    WHERE item_code = 'FS-101-1' LIMIT 1;
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Prodotto FS-101-1 non trovato';
  END IF;

  SELECT id INTO id_es0101 FROM public.items WHERE item_code = 'ES01-01';
  SELECT id INTO id_es0102 FROM public.items WHERE item_code = 'ES01-02';
  SELECT id INTO id_es0103 FROM public.items WHERE item_code = 'ES01-03';
  SELECT id INTO id_es0104 FROM public.items WHERE item_code = 'ES01-04';
  SELECT id INTO id_es0105 FROM public.items WHERE item_code = 'ES01-05';
  SELECT id INTO id_es0107 FROM public.items WHERE item_code = 'ES01-07';
  SELECT id INTO id_es0109 FROM public.items WHERE item_code = 'ES01-09';
  SELECT id INTO id_es0111 FROM public.items WHERE item_code = 'ES01-11';
  SELECT id INTO id_es0112 FROM public.items WHERE item_code = 'ES01-12';
  SELECT id INTO id_es0113 FROM public.items WHERE item_code = 'ES01-13';
  SELECT id INTO id_es0119 FROM public.items WHERE item_code = 'ES01-19';
  SELECT id INTO id_fpmax  FROM public.items WHERE item_code = 'FPMAX01-01';

  -- Purchase Order
  INSERT INTO public.purchase_orders (
    po_number, supplier_id, product_item_id,
    status, order_date, requested_delivery_date,
    currency, total_amount, notes
  ) VALUES (
    'PO-XOM-2026-001', v_supplier_id, v_product_id,
    'confirmed', '2026-01-15', '2026-10-20',
    'EUR', 58416.69,
    'Ordine componenti ES01 + FPMAX01-01 per produzione FS-101-1. 4 consegne scaglionate 2026.'
  ) RETURNING id INTO v_po_id;

  -- PO Lines
  INSERT INTO public.po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
    VALUES (v_po_id, id_es0101, 1863, 4.51,  8402.13, 1)  RETURNING id INTO l_es0101;
  INSERT INTO public.po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
    VALUES (v_po_id, id_es0102, 1863, 2.26,  4210.38, 2)  RETURNING id INTO l_es0102;
  INSERT INTO public.po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
    VALUES (v_po_id, id_es0103, 1391, 9.49, 13200.59, 3)  RETURNING id INTO l_es0103;
  INSERT INTO public.po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
    VALUES (v_po_id, id_es0104, 1391, 8.11, 11281.01, 4)  RETURNING id INTO l_es0104;
  INSERT INTO public.po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
    VALUES (v_po_id, id_es0105, 1863, 3.06,  5700.78, 5)  RETURNING id INTO l_es0105;
  INSERT INTO public.po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
    VALUES (v_po_id, id_es0107, 1863, 0.69,  1285.47, 6)  RETURNING id INTO l_es0107;
  INSERT INTO public.po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
    VALUES (v_po_id, id_es0109, 1863, 1.07,  1993.41, 7)  RETURNING id INTO l_es0109;
  INSERT INTO public.po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
    VALUES (v_po_id, id_es0111, 3727, 1.13,  4211.51, 8)  RETURNING id INTO l_es0111;
  INSERT INTO public.po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
    VALUES (v_po_id, id_es0112, 1863, 1.16,  2161.08, 9)  RETURNING id INTO l_es0112;
  INSERT INTO public.po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
    VALUES (v_po_id, id_es0113, 5591, 0.43,  2404.13, 10) RETURNING id INTO l_es0113;
  INSERT INTO public.po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
    VALUES (v_po_id, id_es0119, 1863, 0.20,   372.60, 11) RETURNING id INTO l_es0119;
  INSERT INTO public.po_lines (purchase_order_id, item_id, quantity, unit_price, line_total, sort_order)
    VALUES (v_po_id, id_fpmax,   450, 10.10, 3393.60, 12) RETURNING id INTO l_fpmax;

  -- Consegna 1 — 20/01/2026 (FPMAX01-01 qty=0, escluso)
  INSERT INTO public.po_deliveries (purchase_order_id, po_line_id, delivery_group_id, scheduled_date, quantity, status)
  VALUES
    (v_po_id, l_es0101, g1, '2026-01-20', 415,  'scheduled'),
    (v_po_id, l_es0102, g1, '2026-01-20', 415,  'scheduled'),
    (v_po_id, l_es0103, g1, '2026-01-20', 279,  'scheduled'),
    (v_po_id, l_es0104, g1, '2026-01-20', 279,  'scheduled'),
    (v_po_id, l_es0105, g1, '2026-01-20', 415,  'scheduled'),
    (v_po_id, l_es0107, g1, '2026-01-20', 415,  'scheduled'),
    (v_po_id, l_es0109, g1, '2026-01-20', 415,  'scheduled'),
    (v_po_id, l_es0111, g1, '2026-01-20', 830,  'scheduled'),
    (v_po_id, l_es0112, g1, '2026-01-20', 415,  'scheduled'),
    (v_po_id, l_es0113, g1, '2026-01-20', 1244, 'scheduled'),
    (v_po_id, l_es0119, g1, '2026-01-20', 415,  'scheduled');

  -- Consegna 2 — 20/04/2026
  INSERT INTO public.po_deliveries (purchase_order_id, po_line_id, delivery_group_id, scheduled_date, quantity, status)
  VALUES
    (v_po_id, l_es0101, g2, '2026-04-20', 603,  'scheduled'),
    (v_po_id, l_es0102, g2, '2026-04-20', 603,  'scheduled'),
    (v_po_id, l_es0103, g2, '2026-04-20', 466,  'scheduled'),
    (v_po_id, l_es0104, g2, '2026-04-20', 466,  'scheduled'),
    (v_po_id, l_es0105, g2, '2026-04-20', 603,  'scheduled'),
    (v_po_id, l_es0107, g2, '2026-04-20', 603,  'scheduled'),
    (v_po_id, l_es0109, g2, '2026-04-20', 603,  'scheduled'),
    (v_po_id, l_es0111, g2, '2026-04-20', 1207, 'scheduled'),
    (v_po_id, l_es0112, g2, '2026-04-20', 603,  'scheduled'),
    (v_po_id, l_es0113, g2, '2026-04-20', 1811, 'scheduled'),
    (v_po_id, l_es0119, g2, '2026-04-20', 603,  'scheduled'),
    (v_po_id, l_fpmax,  g2, '2026-04-20', 184,  'scheduled');

  -- Consegna 3 — 20/07/2026
  INSERT INTO public.po_deliveries (purchase_order_id, po_line_id, delivery_group_id, scheduled_date, quantity, status)
  VALUES
    (v_po_id, l_es0101, g3, '2026-07-20', 410,  'scheduled'),
    (v_po_id, l_es0102, g3, '2026-07-20', 410,  'scheduled'),
    (v_po_id, l_es0103, g3, '2026-07-20', 303,  'scheduled'),
    (v_po_id, l_es0104, g3, '2026-07-20', 303,  'scheduled'),
    (v_po_id, l_es0105, g3, '2026-07-20', 410,  'scheduled'),
    (v_po_id, l_es0107, g3, '2026-07-20', 410,  'scheduled'),
    (v_po_id, l_es0109, g3, '2026-07-20', 410,  'scheduled'),
    (v_po_id, l_es0111, g3, '2026-07-20', 821,  'scheduled'),
    (v_po_id, l_es0112, g3, '2026-07-20', 410,  'scheduled'),
    (v_po_id, l_es0113, g3, '2026-07-20', 1232, 'scheduled'),
    (v_po_id, l_es0119, g3, '2026-07-20', 410,  'scheduled'),
    (v_po_id, l_fpmax,  g3, '2026-07-20', 144,  'scheduled');

  -- Consegna 4 — 20/10/2026
  INSERT INTO public.po_deliveries (purchase_order_id, po_line_id, delivery_group_id, scheduled_date, quantity, status)
  VALUES
    (v_po_id, l_es0101, g4, '2026-10-20', 435,  'scheduled'),
    (v_po_id, l_es0102, g4, '2026-10-20', 435,  'scheduled'),
    (v_po_id, l_es0103, g4, '2026-10-20', 343,  'scheduled'),
    (v_po_id, l_es0104, g4, '2026-10-20', 343,  'scheduled'),
    (v_po_id, l_es0105, g4, '2026-10-20', 435,  'scheduled'),
    (v_po_id, l_es0107, g4, '2026-10-20', 435,  'scheduled'),
    (v_po_id, l_es0109, g4, '2026-10-20', 435,  'scheduled'),
    (v_po_id, l_es0111, g4, '2026-10-20', 869,  'scheduled'),
    (v_po_id, l_es0112, g4, '2026-10-20', 435,  'scheduled'),
    (v_po_id, l_es0113, g4, '2026-10-20', 1304, 'scheduled'),
    (v_po_id, l_es0119, g4, '2026-10-20', 435,  'scheduled'),
    (v_po_id, l_fpmax,  g4, '2026-10-20', 122,  'scheduled');

  -- Storia stato
  INSERT INTO public.po_status_history (purchase_order_id, status, notes)
    VALUES (v_po_id, 'confirmed', 'Ordine inserito via migration');

  RAISE NOTICE 'PO-XOM-2026-001 inserito: ID = %', v_po_id;
END $$;
