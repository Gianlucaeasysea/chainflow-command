-- Aggiungi colonna EAN
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS ean text;

-- Garantisci UNIQUE su item_code per ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_item_code_key'
  ) THEN
    ALTER TABLE public.items ADD CONSTRAINT items_item_code_key UNIQUE (item_code);
  END IF;
END$$;

-- Seed prodotti finiti Easysea
INSERT INTO public.items (item_code, description, item_type, category, unit_of_measure, ean)
VALUES
  ('FS-101-1',  'Flipper™ - Foldable Winch Handle',              'Finished Product', 'Winch Handle',      'PZ', '8059006718817'),
  ('FM-101-1',  'Flipper Max™ Maxi Foldable Winch Handle',       'Finished Product', 'Winch Handle',      'PZ', '8059006710002'),
  ('FCM-101-1', 'Flipper Max™ Carbon Foldable Winch Handle',     'Finished Product', 'Winch Handle',      'PZ', '8059006710361'),
  ('OA-101', 'Olli™ XS - Anti-Shock Low Friction Ring',          'Finished Product', 'Anti-Shock System', 'PZ', '8059006718824'),
  ('OA-102', 'Olli™ S - Anti-Shock Low Friction Ring',           'Finished Product', 'Anti-Shock System', 'PZ', '8059006718831'),
  ('OA-103', 'Olli™ M - Anti-Shock Low Friction Ring',           'Finished Product', 'Anti-Shock System', 'PZ', '8059006718848'),
  ('OA-104', 'Olli™ L - Anti-Shock Low Friction Ring',           'Finished Product', 'Anti-Shock System', 'PZ', '8059006718855'),
  ('LC-101', 'Covered Loop in Dyneema® S Olli™',                 'Finished Product', 'Dyneema Accessory', 'PZ', '8059006710019'),
  ('LC-102', 'Covered Loop Dyneema® M Olli™',                    'Finished Product', 'Dyneema Accessory', 'PZ', '8059006710026'),
  ('LC-103', 'Covered Loop Dyneema® L Olli™',                    'Finished Product', 'Dyneema Accessory', 'PZ', '8059006710033'),
  ('LS-102', 'Sheathed Loop Dyneema® S Olli™',                   'Finished Product', 'Dyneema Accessory', 'PZ', '8059006710057'),
  ('LS-103', 'Sheathed Dyneema® Loop M Olli™',                   'Finished Product', 'Dyneema Accessory', 'PZ', '8059006710064'),
  ('LS-104', 'Sheathed Loop Dyneema® L Olli™',                   'Finished Product', 'Dyneema Accessory', 'PZ', '8059006710071'),
  ('LS-105', 'Sheathed Loop XL Dyneema® Olli™',                  'Finished Product', 'Dyneema Accessory', 'PZ', '8059006710088'),
  ('SS-102', 'Soft Shackle in Dyneema® Olli™ S',                 'Finished Product', 'Dyneema Accessory', 'PZ', '8059006710101'),
  ('SS-103', 'Soft Shackle in Dyneema® Olli™ M',                 'Finished Product', 'Dyneema Accessory', 'PZ', '8059006710118'),
  ('SS-104', 'Soft Shackle in Dyneema® Olli™ L',                 'Finished Product', 'Dyneema Accessory', 'PZ', '8059006710125'),
  ('SRA-101', 'S Solid Ring - Olli™ Anti-Shock System',          'Finished Product', 'Anti-Shock System', 'PZ', '8059006710194'),
  ('SRA-102', 'M Solid Ring - Olli™ Anti-Shock System',          'Finished Product', 'Anti-Shock System', 'PZ', '8059006710200'),
  ('SRA-103', 'L Solid Ring - Olli™ Anti-Shock System',          'Finished Product', 'Anti-Shock System', 'PZ', '8059006710217'),
  ('SRA-104', 'XL Solid Ring - Olli™ Anti-Shock System',         'Finished Product', 'Anti-Shock System', 'PZ', '8059006710224'),
  ('OB-101', 'Olli Anti-Shock Snatch Block XS',                  'Finished Product', 'Snatch Block',      'PZ', '8059006710309'),
  ('OB-102', 'Olli Anti-Shock Snatch Block S',                   'Finished Product', 'Snatch Block',      'PZ', '8059006710316'),
  ('OB-103', 'Olli Anti-Shock Snatch Block M',                   'Finished Product', 'Snatch Block',      'PZ', '8059006710293'),
  ('OB-104', 'Olli Anti-Shock Snatch Block L',                   'Finished Product', 'Snatch Block',      'PZ', '8059006710323'),
  ('OB-105', 'Olli Anti-Shock Snatch Block XL',                  'Finished Product', 'Snatch Block',      'PZ', '8059006710330'),
  ('CWC-101GY', 'Covy Anti-Mould Winch Cover S',                 'Finished Product', 'Winch Cover',       'PZ', '8059006710262'),
  ('CWC-102GY', 'Covy Anti-Mould Winch Cover M',                 'Finished Product', 'Winch Cover',       'PZ', '8059006710279'),
  ('CWC-103GY', 'Covy Anti-Mould Winch Cover L',                 'Finished Product', 'Winch Cover',       'PZ', '8059006710286'),
  ('CWC-104GY', 'Covy Anti-Mould Winch Cover XL',                'Finished Product', 'Winch Cover',       'PZ', '8059006710347'),
  ('SP-101',  'Spira – The Twistable Guardrail Cover',           'Finished Product', 'Guardrail Cover',   'PZ', '8059006710385'),
  ('W2G-101', 'Way2 - The Inflatable Reversible Gangway',        'Finished Product', 'Gangway',           'PZ', '8059006710354'),
  ('ROD-101', 'Rope Deflector',                                  'Finished Product', 'Rope Deflector',    'PZ', '8059006710378'),
  ('JTP-101', 'Jake™ – Telescopic Pole 192',                     'Finished Product', 'Jake System',       'PZ', '8059006711603'),
  ('JSP-101', 'Jake™ – Short Pole',                              'Finished Product', 'Jake System',       'PZ', '8059006711610'),
  ('JBH-101', 'Jake™ – Boat Hook Head',                          'Finished Product', 'Jake System',       'PZ', '8059006711627'),
  ('JLH-101', 'Jake™ – Line-Passing Head',                       'Finished Product', 'Jake System',       'PZ', '8059006711641'),
  ('JQH-101', 'Jake™ – Line-Master Head',                        'Finished Product', 'Jake System',       'PZ', '8059006711658'),
  ('JBR-101', 'Jake™ – Brush Head',                              'Finished Product', 'Jake System',       'PZ', '8059006711634'),
  ('JQK-101', 'Jake™ – Quick-Release',                           'Finished Product', 'Jake System',       'PZ', '8059006711665'),
  ('JAK-101', 'Jake™ Full Kit - All-In-One',                     'Assembly',         'Jake System',       'KIT','8059006711672'),
  ('JAK-102', 'Jake™ Basic Kit (Telescopic Pole + Boat Hook)',   'Assembly',         'Jake System',       'KIT','8059006711689'),
  ('JAK-103', 'Jake™ Mid Kit (Pole + Boat Hook + Line-Passing + Quick-Release)', 'Assembly', 'Jake System', 'KIT','8059006711696')
ON CONFLICT (item_code) DO UPDATE SET
  description     = EXCLUDED.description,
  item_type       = EXCLUDED.item_type,
  category        = EXCLUDED.category,
  unit_of_measure = EXCLUDED.unit_of_measure,
  ean             = EXCLUDED.ean;