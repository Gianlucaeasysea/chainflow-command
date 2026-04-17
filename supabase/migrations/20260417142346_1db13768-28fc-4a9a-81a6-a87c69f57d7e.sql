
-- Add unique constraint for upserting BOM headers by (item_id, version)
ALTER TABLE public.bom_headers
  DROP CONSTRAINT IF EXISTS bom_headers_item_version_key;
ALTER TABLE public.bom_headers
  ADD CONSTRAINT bom_headers_item_version_key UNIQUE (item_id, version);

-- ============================================================
-- STEP 1: COMPONENTS & WORK CENTERS (assembly)
-- ============================================================
INSERT INTO public.items (item_code, description, item_type, unit_of_measure, unit_cost, assembly_cost, category)
VALUES
-- Componenti meccanici condivisi Flipper
('ES01-01',   'Base pomello alluminio',                 'component', 'PZ', 4.10, 0, 'Componente'),
('ES01-02',   'Ginocchio / Cerniera alluminio',         'component', 'PZ', 1.90, 0, 'Componente'),
('ES01-03',   'Anello alluminio (Flipper Standard)',    'component', 'PZ', 9.30, 0, 'Componente'),
('ES01-04',   'Stella alluminio (Flipper Standard)',    'component', 'PZ', 7.84, 0, 'Componente'),
('ES01-05',   'Perno sblocco inox',                     'component', 'PZ', 2.72, 0, 'Componente'),
('ES01-06',   'Perno A4 M8x50mm',                       'component', 'PZ', 0.20, 0, 'Componente'),
('ES01-07',   'Boccola bassa nylon',                    'component', 'PZ', 0.55, 0, 'Componente'),
('ES01-08',   'Fermo inox A4 3x20mm',                   'component', 'PZ', 0.17, 0, 'Componente'),
('ES01-09',   'Boccola alta derlin',                    'component', 'PZ', 0.61, 0, 'Componente'),
('ES01-10',   'Pomello ABS',                            'component', 'PZ', 1.62, 0, 'Componente'),
('ES01-11',   'Perno lungo inox',                       'component', 'PZ', 0.78, 0, 'Componente'),
('ES01-12',   'Perno corto inox',                       'component', 'PZ', 0.85, 0, 'Componente'),
('ES01-13',   'Spinetta inox',                          'component', 'PZ', 0.36, 0, 'Componente'),
('ES01-14',   'Tappetto ABS',                           'component', 'PZ', 0.67, 0, 'Componente'),
('ES01-15',   'Ring logo silicone blu',                 'component', 'PZ', 0.32, 0, 'Componente'),
('ES01-16',   'Molla inox',                             'component', 'PZ', 0.12, 0, 'Componente'),
('ES01-18',   'Levetta ABS',                            'component', 'PZ', 0.15, 0, 'Componente'),
('ES01-19',   'Boccola nylon nero',                     'component', 'PZ', 0.15, 0, 'Componente'),
('ES01-20',   'Boccola eccentrica',                     'component', 'PZ', 0.44, 0, 'Componente'),
-- Componenti esclusivi Flipper Max
('FPMAX01-01','Anello alluminio lungo (Flipper Max)',   'component', 'PZ', 18.50, 0, 'Componente'),
('FPMAX01-02','Stella alluminio lunga (Flipper Max)',   'component', 'PZ', 19.98, 0, 'Componente'),
-- Packaging Flipper Standard
('PKF-1',     'Scatola Flipper (sagomato)',             'packaging', 'PZ', 5.94, 0, 'Imballaggio'),
('PKF-3',     'Libretto istruzioni Flipper',            'packaging', 'PZ', 0.03, 0, 'Imballaggio'),
('PKF-4',     'Etichetta adesiva Flipper',              'packaging', 'PZ', 0.13, 0, 'Imballaggio'),
-- Packaging Flipper Max
('PAB-01',    'Scatola Flipper Max',                    'packaging', 'PZ', 2.96, 0, 'Imballaggio'),
('EVAMAX-01', 'Inserto EVA Flipper Max',                'packaging', 'PZ', 1.07, 0, 'Imballaggio'),
('PKF-4.1',   'Libretto istruzioni Flipper Max',        'packaging', 'PZ', 0.03, 0, 'Imballaggio'),
('F-FM-101',  'Etichetta adesiva Flipper Max',          'packaging', 'PZ', 1.30, 0, 'Imballaggio'),
-- Centri di lavoro (Fonderia Mestieri)
('ASFLST01',  'Assemblaggio Flipper Standard',          'assembly',  'OP', 0, 2.55, 'Lavorazione'),
('FPFLST01',  'Foratura pomello Flipper',               'assembly',  'OP', 0, 0.30, 'Lavorazione'),
('COFLST01',  'Confezionamento Flipper Standard',       'assembly',  'OP', 0, 1.50, 'Lavorazione'),
('ASFMST01',  'Assemblaggio Flipper Max',               'assembly',  'OP', 0, 2.55, 'Lavorazione'),
('COFMST01',  'Confezionamento Flipper Max',            'assembly',  'OP', 0, 1.50, 'Lavorazione'),
-- Componenti Olli Block S
('POBS-01',   'Puleggia Olli Block S',                  'component', 'PZ', 2.85, 0, 'Componente'),
('UBOBS-02',  'Upper Body Olli Block S',                'component', 'PZ', 2.85, 0, 'Componente'),
('LBOBS-03',  'Lower Body Olli Block S',                'component', 'PZ', 2.11, 0, 'Componente'),
('TBOBS-04',  'T-Bone Olli Block S',                    'component', 'PZ', 0.35, 0, 'Componente'),
('CDOBS-05',  'Cover derlin Olli Block S',              'component', 'PZ', 1.75, 0, 'Componente'),
('DYOBS-01',  'Dyneema 4mm 160mm Olli Block S',         'raw_material', 'M', 14.00, 0, 'Materia Prima'),
('BIOBS-01',  'Bronzina SOLEF Olli Block S',            'component', 'PZ', 1.10, 0, 'Componente'),
('PKOBS-CART','Cartoncino Olli Block S',                'packaging', 'PZ', 0.50, 0, 'Imballaggio'),
('PKOBS-FAS', 'Fascetta nera Olli Block S',             'packaging', 'PZ', 0.02, 0, 'Imballaggio'),
('PKOBS-ADH', 'Adesivo Olli Block S',                   'packaging', 'PZ', 0.10, 0, 'Imballaggio'),
('ASOB102',   'Montaggio Olli Block S',                 'assembly',  'OP', 0, 1.08, 'Lavorazione'),
('COOB102',   'Confezionamento Olli Block S',           'assembly',  'OP', 0, 0.80, 'Lavorazione'),
-- Componenti Olli Block M
('POBM-01',   'Puleggia Olli Block M',                  'component', 'PZ', 3.00, 0, 'Componente'),
('UBOBM-02',  'Upper Body Olli Block M',                'component', 'PZ', 3.00, 0, 'Componente'),
('LBOBM-03',  'Lower Body Olli Block M',                'component', 'PZ', 2.23, 0, 'Componente'),
('TBOBM-04',  'T-Bone Olli Block M',                    'component', 'PZ', 0.36, 0, 'Componente'),
('CDOBM-05',  'Cover derlin Olli Block M',              'component', 'PZ', 2.24, 0, 'Componente'),
('DYOBM-01',  'Dyneema 5mm 220mm Olli Block M',         'raw_material', 'M', 14.50, 0, 'Materia Prima'),
('BIOBM-01',  'Bronzina SOLEF Olli Block M',            'component', 'PZ', 1.52, 0, 'Componente'),
('PKOBM-ADH', 'Adesivo Olli Block M',                   'packaging', 'PZ', 0.10, 0, 'Imballaggio'),
('PKOBM-CART','Cartoncino Olli Block M',                'packaging', 'PZ', 0.50, 0, 'Imballaggio'),
('PKOBM-FAS', 'Fascetta nera Olli Block M',             'packaging', 'PZ', 0.02, 0, 'Imballaggio'),
('ASOB103',   'Montaggio Olli Block M',                 'assembly',  'OP', 0, 1.08, 'Lavorazione'),
('COOB103',   'Confezionamento Olli Block M',           'assembly',  'OP', 0, 0.80, 'Lavorazione'),
-- Componenti Olli Block L
('POBL-01',   'Puleggia Olli Block L',                  'component', 'PZ', 6.00, 0, 'Componente'),
('UBOBL-02',  'Upper Body Olli Block L',                'component', 'PZ', 5.11, 0, 'Componente'),
('LBOBL-03',  'Lower Body Olli Block L',                'component', 'PZ', 3.42, 0, 'Componente'),
('TBOBL-04',  'T-Bone Olli Block L',                    'component', 'PZ', 0.90, 0, 'Componente'),
('CDOBL-05',  'Cover derlin Olli Block L',              'component', 'PZ', 2.84, 0, 'Componente'),
('BTOBL-06',  'Boccola teflon Olli Block L',            'component', 'PZ', 0.00, 0, 'Componente'),
('DYOBL-01',  'Dyneema 6mm 280mm Olli Block L',         'raw_material', 'M', 15.50, 0, 'Materia Prima'),
('BIOBL-01',  'Bronzina SOLEF Olli Block L',            'component', 'PZ', 1.95, 0, 'Componente'),
('PKOBL-CART','Cartoncino Olli Block L',                'packaging', 'PZ', 0.50, 0, 'Imballaggio'),
('PKOBL-ADH', 'Adesivo Olli Block L',                   'packaging', 'PZ', 0.01, 0, 'Imballaggio'),
('PKOBL-FAS', 'Fascetta nera Olli Block L',             'packaging', 'PZ', 0.02, 0, 'Imballaggio'),
('ASOB104',   'Montaggio Olli Block L',                 'assembly',  'OP', 0, 1.08, 'Lavorazione'),
('COOB104',   'Confezionamento Olli Block L',           'assembly',  'OP', 0, 0.80, 'Lavorazione')
ON CONFLICT (item_code) DO UPDATE SET
  description     = EXCLUDED.description,
  item_type       = EXCLUDED.item_type,
  unit_of_measure = EXCLUDED.unit_of_measure,
  unit_cost       = EXCLUDED.unit_cost,
  assembly_cost   = EXCLUDED.assembly_cost,
  category        = EXCLUDED.category;

-- ============================================================
-- STEP 2: BOM HEADERS for the 5 finished products
-- ============================================================
INSERT INTO public.bom_headers (item_id, version, status, notes)
SELECT i.id, 1, 'active', 'Distinta base iniziale caricata da migration'
FROM public.items i
WHERE i.item_code IN ('FS-101-1', 'FM-101-1', 'OB-102', 'OB-103', 'OB-104')
ON CONFLICT (item_id, version) DO UPDATE SET
  status = EXCLUDED.status,
  notes  = EXCLUDED.notes;

-- ============================================================
-- STEP 3: BOM LINES (clear & reinsert per BOM to ensure idempotency)
-- ============================================================

-- ---- BOM FS-101-1: Flipper Standard ----
DELETE FROM public.bom_lines
WHERE bom_header_id = (
  SELECT id FROM public.bom_headers
  WHERE item_id = (SELECT id FROM public.items WHERE item_code='FS-101-1') AND version=1
);

WITH bom AS (
  SELECT id FROM public.bom_headers
  WHERE item_id = (SELECT id FROM public.items WHERE item_code='FS-101-1') AND version=1
)
INSERT INTO public.bom_lines (bom_header_id, component_item_id, quantity, waste_pct, sort_order)
SELECT bom.id, i.id, t.qty, 0, t.sort
FROM bom, (VALUES
  ('ES01-01',  1, 1),  ('ES01-02',  1, 2),  ('ES01-03',  1, 3),
  ('ES01-04',  1, 4),  ('ES01-05',  1, 5),  ('ES01-06',  1, 6),
  ('ES01-07',  1, 7),  ('ES01-08',  1, 8),  ('ES01-09',  1, 9),
  ('ES01-10',  1, 10), ('ES01-11',  2, 11), ('ES01-12',  1, 12),
  ('ES01-13',  3, 13), ('ES01-14',  1, 14), ('ES01-15',  1, 15),
  ('ES01-16',  1, 16), ('ES01-18',  1, 17), ('ES01-19',  1, 18),
  ('ES01-20',  2, 19), ('PKF-1',    1, 20), ('PKF-3',    1, 21),
  ('PKF-4',    2, 22), ('ASFLST01', 1, 23), ('FPFLST01', 1, 24),
  ('COFLST01', 1, 25)
) AS t(code, qty, sort)
JOIN public.items i ON i.item_code = t.code;

-- ---- BOM FM-101-1: Flipper Max ----
DELETE FROM public.bom_lines
WHERE bom_header_id = (
  SELECT id FROM public.bom_headers
  WHERE item_id = (SELECT id FROM public.items WHERE item_code='FM-101-1') AND version=1
);

WITH bom AS (
  SELECT id FROM public.bom_headers
  WHERE item_id = (SELECT id FROM public.items WHERE item_code='FM-101-1') AND version=1
)
INSERT INTO public.bom_lines (bom_header_id, component_item_id, quantity, waste_pct, sort_order)
SELECT bom.id, i.id, t.qty, 0, t.sort
FROM bom, (VALUES
  ('ES01-01',    1, 1),  ('ES01-02',    1, 2),
  ('FPMAX01-01', 1, 3),  ('FPMAX01-02', 1, 4),
  ('ES01-05',    1, 5),  ('ES01-06',    1, 6),  ('ES01-07', 1, 7),
  ('ES01-08',    1, 8),  ('ES01-09',    1, 9),  ('ES01-10', 1, 10),
  ('ES01-11',    2, 11), ('ES01-12',    1, 12), ('ES01-13', 3, 13),
  ('ES01-14',    1, 14), ('ES01-15',    1, 15), ('ES01-16', 1, 16),
  ('ES01-18',    1, 17), ('ES01-19',    1, 18), ('ES01-20', 2, 19),
  ('PAB-01',     1, 20), ('EVAMAX-01',  1, 21), ('PKF-4.1', 1, 22),
  ('F-FM-101',   1, 23), ('ASFMST01',   1, 24), ('FPFLST01',1, 25),
  ('COFMST01',   1, 26)
) AS t(code, qty, sort)
JOIN public.items i ON i.item_code = t.code;

-- ---- BOM OB-102: Olli Block S ----
DELETE FROM public.bom_lines
WHERE bom_header_id = (
  SELECT id FROM public.bom_headers
  WHERE item_id = (SELECT id FROM public.items WHERE item_code='OB-102') AND version=1
);

WITH bom AS (
  SELECT id FROM public.bom_headers
  WHERE item_id = (SELECT id FROM public.items WHERE item_code='OB-102') AND version=1
)
INSERT INTO public.bom_lines (bom_header_id, component_item_id, quantity, waste_pct, sort_order)
SELECT bom.id, i.id, t.qty, 0, t.sort
FROM bom, (VALUES
  ('POBS-01',    1, 1),  ('UBOBS-02',  1, 2),  ('LBOBS-03', 1, 3),
  ('TBOBS-04',   1, 4),  ('CDOBS-05',  2, 5),  ('DYOBS-01', 1, 6),
  ('BIOBS-01',   1, 7),  ('PKOBS-CART',1, 8),  ('PKOBS-FAS',1, 9),
  ('PKOBS-ADH',  1, 10), ('ASOB102',   1, 11), ('COOB102',  1, 12)
) AS t(code, qty, sort)
JOIN public.items i ON i.item_code = t.code;

-- ---- BOM OB-103: Olli Block M ----
DELETE FROM public.bom_lines
WHERE bom_header_id = (
  SELECT id FROM public.bom_headers
  WHERE item_id = (SELECT id FROM public.items WHERE item_code='OB-103') AND version=1
);

WITH bom AS (
  SELECT id FROM public.bom_headers
  WHERE item_id = (SELECT id FROM public.items WHERE item_code='OB-103') AND version=1
)
INSERT INTO public.bom_lines (bom_header_id, component_item_id, quantity, waste_pct, sort_order)
SELECT bom.id, i.id, t.qty, 0, t.sort
FROM bom, (VALUES
  ('POBM-01',    1, 1),  ('UBOBM-02',  1, 2),  ('LBOBM-03', 1, 3),
  ('TBOBM-04',   1, 4),  ('CDOBM-05',  2, 5),  ('DYOBM-01', 1, 6),
  ('BIOBM-01',   1, 7),  ('PKOBM-ADH', 1, 8),  ('PKOBM-CART',1, 9),
  ('PKOBM-FAS',  1, 10), ('ASOB103',   1, 11), ('COOB103',  1, 12)
) AS t(code, qty, sort)
JOIN public.items i ON i.item_code = t.code;

-- ---- BOM OB-104: Olli Block L ----
DELETE FROM public.bom_lines
WHERE bom_header_id = (
  SELECT id FROM public.bom_headers
  WHERE item_id = (SELECT id FROM public.items WHERE item_code='OB-104') AND version=1
);

WITH bom AS (
  SELECT id FROM public.bom_headers
  WHERE item_id = (SELECT id FROM public.items WHERE item_code='OB-104') AND version=1
)
INSERT INTO public.bom_lines (bom_header_id, component_item_id, quantity, waste_pct, sort_order)
SELECT bom.id, i.id, t.qty, 0, t.sort
FROM bom, (VALUES
  ('POBL-01',    1, 1),  ('UBOBL-02',  1, 2),  ('LBOBL-03', 1, 3),
  ('TBOBL-04',   1, 4),  ('CDOBL-05',  2, 5),  ('BTOBL-06', 2, 6),
  ('DYOBL-01',   1, 7),  ('BIOBL-01',  1, 8),  ('PKOBL-CART',1, 9),
  ('PKOBL-ADH',  1, 10), ('PKOBL-FAS', 1, 11), ('ASOB104',  1, 12),
  ('COOB104',    1, 13)
) AS t(code, qty, sort)
JOIN public.items i ON i.item_code = t.code;
