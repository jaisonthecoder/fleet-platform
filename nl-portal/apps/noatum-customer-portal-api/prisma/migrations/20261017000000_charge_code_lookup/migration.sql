-- ---------------------------------------------------------------------------
-- Charge codes become a lookup
--
-- The pricing screen offered no list at all: a pricer typed the code from
-- memory, which is how one branch books ocean freight as FRT, another as OFR
-- and a third as FREIGHT — and how the charge mix on the same screen then
-- groups them into three different families.
--
-- Same rule as carriers and charge bases: the list is a convenience, never a
-- constraint. The column stays free text so nobody is blocked at 17:40 waiting
-- for an administrator to add a code.
--
-- The seed is ordinary sea and air forwarding practice, grouped so the mix bar
-- reads sensibly: freight and its adjustments, origin, customs, then delivery
-- and the rest. Codes are the short forms in common use; the label is what the
-- code actually means, because FRT tells a new pricer nothing.
-- ---------------------------------------------------------------------------

INSERT INTO lookup_category (code, name, description, ownership, default_locale, sort_order)
VALUES (
  'charge_code',
  'Charge codes',
  'The short code on a charge line. Offered on the pricing screen; staff may still type a code that is not on the list.',
  'portal',
  'en-US',
  62
)
ON CONFLICT (code) DO NOTHING;

WITH category AS (
  SELECT id FROM lookup_category WHERE code = 'charge_code'
),
seed (code, en, es, sort_order) AS (
  VALUES
    -- freight and its adjustments
    ('FRT',  'Ocean or air freight',          'Flete marítimo o aéreo',          10),
    ('BAF',  'Bunker adjustment',             'Ajuste por combustible',          20),
    ('CAF',  'Currency adjustment',           'Ajuste por divisa',               30),
    ('GRI',  'General rate increase',         'Incremento general de tarifa',    40),
    ('PSS',  'Peak season surcharge',         'Recargo de temporada alta',       50),
    ('WRS',  'War risk surcharge',            'Recargo por riesgo de guerra',    60),
    -- origin
    ('THC',  'Terminal handling',             'Manipulación en terminal',        70),
    ('DOC',  'Documentation and B/L',         'Documentación y B/L',             80),
    ('ISPS', 'Port security',                 'Seguridad portuaria',             90),
    ('EXP',  'Export formalities',            'Formalidades de exportación',    100),
    ('PCF',  'Pre-carriage to port',          'Pre-transporte a puerto',        110),
    -- customs
    ('CUS',  'Customs entry',                 'Despacho de aduanas',            120),
    ('DGS',  'Dangerous goods handling',      'Manipulación de mercancía peligrosa', 130),
    ('VET',  'Inspection or veterinary',      'Inspección o veterinario',       140),
    -- delivery and the rest
    ('DLV',  'Delivery to door',              'Entrega a domicilio',            150),
    ('DEM',  'Demurrage and detention',       'Demoras y detención',            160),
    ('STO',  'Storage',                       'Almacenaje',                     170),
    ('INS',  'Cargo insurance',               'Seguro de mercancía',            180),
    ('REF',  'Reefer plug and monitoring',    'Conexión y control de reefer',   190),
    ('OOG',  'Out of gauge or lifting',       'Fuera de gálibo o izaje',        200),
    ('ADM',  'Administration fee',            'Gastos de administración',       210)
)
INSERT INTO lookup_item (category_id, code, sort_order, is_active, is_customer_visible)
SELECT category.id, seed.code, seed.sort_order, true, true
FROM seed CROSS JOIN category
ON CONFLICT (category_id, code) DO NOTHING;

-- Customer-visible: the code and its meaning are printed beside each charge line
-- on a published option, so these labels reach customers and are translated.
INSERT INTO lookup_item_translation (item_id, locale, label)
SELECT item.id, locale.locale, locale.label
FROM (
  VALUES
    ('FRT',  'Ocean or air freight',       'Flete marítimo o aéreo'),
    ('BAF',  'Bunker adjustment',          'Ajuste por combustible'),
    ('CAF',  'Currency adjustment',        'Ajuste por divisa'),
    ('GRI',  'General rate increase',      'Incremento general de tarifa'),
    ('PSS',  'Peak season surcharge',      'Recargo de temporada alta'),
    ('WRS',  'War risk surcharge',         'Recargo por riesgo de guerra'),
    ('THC',  'Terminal handling',          'Manipulación en terminal'),
    ('DOC',  'Documentation and B/L',      'Documentación y B/L'),
    ('ISPS', 'Port security',              'Seguridad portuaria'),
    ('EXP',  'Export formalities',         'Formalidades de exportación'),
    ('PCF',  'Pre-carriage to port',       'Pre-transporte a puerto'),
    ('CUS',  'Customs entry',              'Despacho de aduanas'),
    ('DGS',  'Dangerous goods handling',   'Manipulación de mercancía peligrosa'),
    ('VET',  'Inspection or veterinary',   'Inspección o veterinario'),
    ('DLV',  'Delivery to door',           'Entrega a domicilio'),
    ('DEM',  'Demurrage and detention',    'Demoras y detención'),
    ('STO',  'Storage',                    'Almacenaje'),
    ('INS',  'Cargo insurance',            'Seguro de mercancía'),
    ('REF',  'Reefer plug and monitoring', 'Conexión y control de reefer'),
    ('OOG',  'Out of gauge or lifting',    'Fuera de gálibo o izaje'),
    ('ADM',  'Administration fee',         'Gastos de administración')
) AS seed (code, en, es)
JOIN lookup_item item
  ON item.code = seed.code
 AND item.category_id = (SELECT id FROM lookup_category WHERE code = 'charge_code')
CROSS JOIN LATERAL (
  VALUES ('en-US', seed.en), ('es-ES', seed.es)
) AS locale (locale, label)
ON CONFLICT (item_id, locale) DO NOTHING;
