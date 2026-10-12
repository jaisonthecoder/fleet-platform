-- ---------------------------------------------------------------------------
-- Charge bases become a lookup
--
-- They were a TypeScript constant, which meant the business could not add
-- "per axle" or "per TEU" without a deployment. Every other option list in this
-- product is maintained on the Lookups screen; this one had no reason to be
-- different beyond the order it was written in.
--
-- Same rule as carriers: the list is a convenience, not a constraint. The column
-- stays free text so a pricer is never blocked at 17:40 waiting for an
-- administrator.
--
-- Taken from ordinary sea and air practice, not invented:
--   W/M is "weight or measure", billed on whichever is greater - standard on LCL.
--   Per B/L and per house B/L differ once a consolidation is split.
--   Percentage covers ad valorem and insurance, where the pricer has already
--   worked the figure out; nothing in the platform computes a percentage.
-- ---------------------------------------------------------------------------

INSERT INTO lookup_category (code, name, description, ownership, default_locale, sort_order)
VALUES (
  'charge_basis',
  'Charge bases',
  'How a charge line is counted. Offered on the pricing screen; staff may still type a basis that is not on the list.',
  'portal',
  'en-US',
  61
)
ON CONFLICT (code) DO NOTHING;

WITH category AS (
  SELECT id FROM lookup_category WHERE code = 'charge_basis'
),
seed (code, en, es, sort_order) AS (
  VALUES
    ('PER_CONTAINER',   'Per container',           'Por contenedor',            10),
    ('PER_SHIPMENT',    'Per shipment',            'Por envío',                 20),
    ('PER_BL',          'Per B/L',                 'Por B/L',                   30),
    ('PER_HOUSE_BL',    'Per house B/L',           'Por B/L hijo',              40),
    ('PER_KG',          'Per kg',                  'Por kg',                    50),
    ('PER_CHARGEABLE',  'Per chargeable kg',       'Por kg facturable',         60),
    ('PER_CBM',         'Per CBM',                 'Por m³',                    70),
    ('PER_WM',          'Per W/M',                 'Por peso/volumen',          80),
    ('PER_PALLET',      'Per pallet',              'Por palé',                  90),
    ('PER_DOCUMENT',    'Per document',            'Por documento',            100),
    ('PER_DECLARATION', 'Per customs declaration', 'Por declaración aduanera', 110),
    ('PER_HS_CODE',     'Per HS code',             'Por código HS',            120),
    ('PER_HOUR',        'Per hour',                'Por hora',                 130),
    ('PER_DAY',         'Per day',                 'Por día',                  140),
    ('PERCENTAGE',      'Percentage',              'Porcentaje',               150),
    ('LUMP_SUM',        'Lump sum',                'Importe global',           160)
)
INSERT INTO lookup_item (category_id, code, sort_order, is_active, is_customer_visible)
SELECT category.id, seed.code, seed.sort_order, true, true
FROM seed CROSS JOIN category
ON CONFLICT (category_id, code) DO NOTHING;

-- Customer-visible: the basis is printed beside each charge line on a published
-- option, so these labels reach customers and are genuinely translated.
INSERT INTO lookup_item_translation (item_id, locale, label)
SELECT i.id, 'en-US', seed.en
FROM (
  VALUES
    ('PER_CONTAINER', 'Per container'), ('PER_SHIPMENT', 'Per shipment'), ('PER_BL', 'Per B/L'),
    ('PER_HOUSE_BL', 'Per house B/L'), ('PER_KG', 'Per kg'), ('PER_CHARGEABLE', 'Per chargeable kg'),
    ('PER_CBM', 'Per CBM'), ('PER_WM', 'Per W/M'), ('PER_PALLET', 'Per pallet'),
    ('PER_DOCUMENT', 'Per document'), ('PER_DECLARATION', 'Per customs declaration'),
    ('PER_HS_CODE', 'Per HS code'), ('PER_HOUR', 'Per hour'), ('PER_DAY', 'Per day'),
    ('PERCENTAGE', 'Percentage'), ('LUMP_SUM', 'Lump sum')
) AS seed (code, en)
JOIN lookup_item i ON i.code = seed.code
JOIN lookup_category c ON c.id = i.category_id AND c.code = 'charge_basis'
ON CONFLICT (item_id, locale) DO NOTHING;

INSERT INTO lookup_item_translation (item_id, locale, label)
SELECT i.id, 'es-ES', seed.es
FROM (
  VALUES
    ('PER_CONTAINER', 'Por contenedor'), ('PER_SHIPMENT', 'Por envío'), ('PER_BL', 'Por B/L'),
    ('PER_HOUSE_BL', 'Por B/L hijo'), ('PER_KG', 'Por kg'), ('PER_CHARGEABLE', 'Por kg facturable'),
    ('PER_CBM', 'Por m³'), ('PER_WM', 'Por peso/volumen'), ('PER_PALLET', 'Por palé'),
    ('PER_DOCUMENT', 'Por documento'), ('PER_DECLARATION', 'Por declaración aduanera'),
    ('PER_HS_CODE', 'Por código HS'), ('PER_HOUR', 'Por hora'), ('PER_DAY', 'Por día'),
    ('PERCENTAGE', 'Porcentaje'), ('LUMP_SUM', 'Importe global')
) AS seed (code, es)
JOIN lookup_item i ON i.code = seed.code
JOIN lookup_category c ON c.id = i.category_id AND c.code = 'charge_basis'
ON CONFLICT (item_id, locale) DO NOTHING;
