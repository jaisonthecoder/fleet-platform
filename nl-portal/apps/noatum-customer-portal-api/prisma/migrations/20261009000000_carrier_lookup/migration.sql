-- ---------------------------------------------------------------------------
-- Carriers become a lookup
--
-- `quote_option.carrier_name` was free text and nothing else, so "Hapag-Lloyd",
-- "Hapag Lloyd" and "HL" were three carriers as far as any report was concerned.
--
-- This adds a maintained list WITHOUT making the column a foreign key. Both
-- matter:
--   - a list, so the common case is one click and one spelling;
--   - still free text, because a pricer quoting a feeder operator or a new NVOCC
--     at 17:40 must not be blocked waiting for an administrator to add a row.
-- The screen offers the list and accepts anything, which is what the business
-- actually does.
--
-- `ownership = 'portal'`: Noatum maintains this on the Lookups screen. It is not
-- imported from CargoWise and must not be overwritten by a sync.
--
-- `is_customer_visible = true`: the carrier is shown on a published option when
-- the branch discloses it, so these labels reach customers and are translated.
--
-- `metadata.modes` lets the pricing screen offer only the carriers that make
-- sense for the mode being quoted. It is a hint for filtering, never a rule - the
-- field still accepts anything typed.
-- ---------------------------------------------------------------------------

INSERT INTO lookup_category (code, name, description, ownership, default_locale, sort_order)
VALUES (
  'carrier',
  'Carriers',
  'Ocean and air carriers offered on quote options. The list is a convenience; staff may still type a carrier that is not on it.',
  'portal',
  'en-US',
  60
)
ON CONFLICT (code) DO NOTHING;

WITH category AS (
  SELECT id FROM lookup_category WHERE code = 'carrier'
),
seed (code, label, modes, sort_order) AS (
  VALUES
    -- Ocean. Codes are the carrier's usual SCAC, which is what appears on a B/L.
    ('MSCU', 'MSC',                    '["sea"]'::jsonb,  10),
    ('MAEU', 'Maersk',                 '["sea"]'::jsonb,  20),
    ('CMDU', 'CMA CGM',                '["sea"]'::jsonb,  30),
    ('COSU', 'COSCO Shipping',         '["sea"]'::jsonb,  40),
    ('HLCU', 'Hapag-Lloyd',            '["sea"]'::jsonb,  50),
    ('ONEY', 'ONE (Ocean Network Express)', '["sea"]'::jsonb, 60),
    ('EGLV', 'Evergreen Line',         '["sea"]'::jsonb,  70),
    ('HDMU', 'HMM',                    '["sea"]'::jsonb,  80),
    ('YMLU', 'Yang Ming',              '["sea"]'::jsonb,  90),
    ('ZIMU', 'ZIM',                    '["sea"]'::jsonb, 100),
    ('PABV', 'PIL (Pacific International Lines)', '["sea"]'::jsonb, 110),
    ('WHLC', 'Wan Hai Lines',          '["sea"]'::jsonb, 120),
    ('OOLU', 'OOCL',                   '["sea"]'::jsonb, 130),
    -- Air. Codes are the IATA airline prefix used on the air waybill.
    ('020',  'Lufthansa Cargo',        '["air"]'::jsonb, 200),
    ('176',  'Emirates SkyCargo',      '["air"]'::jsonb, 210),
    ('157',  'Qatar Airways Cargo',    '["air"]'::jsonb, 220),
    ('235',  'Turkish Cargo',          '["air"]'::jsonb, 230),
    ('160',  'Cathay Cargo',           '["air"]'::jsonb, 240),
    ('057',  'Air France Cargo',       '["air"]'::jsonb, 250),
    ('074',  'KLM Cargo',              '["air"]'::jsonb, 260),
    ('075',  'Iberia Cargo',           '["air"]'::jsonb, 270),
    ('618',  'Singapore Airlines Cargo', '["air"]'::jsonb, 280),
    -- Road and rail are usually the forwarder's own subcontractors, so the list
    -- carries only the obvious pan-European ones and expects free text.
    ('DBSR', 'DB Schenker',            '["road","rail"]'::jsonb, 300),
    ('DSVR', 'DSV Road',               '["road"]'::jsonb, 310)
)
INSERT INTO lookup_item (category_id, code, sort_order, is_active, is_customer_visible, metadata)
SELECT category.id, seed.code, seed.sort_order, true, true, jsonb_build_object('modes', seed.modes)
FROM seed CROSS JOIN category
ON CONFLICT (category_id, code) DO NOTHING;

-- A carrier's trading name is the same in every language, so both locales carry
-- the same label rather than a translated one. Seeding both keeps the item
-- resolvable whichever locale the reader is in.
INSERT INTO lookup_item_translation (item_id, locale, label)
SELECT i.id, locale.code, seed.label
FROM (
  VALUES
    ('MSCU', 'MSC'), ('MAEU', 'Maersk'), ('CMDU', 'CMA CGM'), ('COSU', 'COSCO Shipping'),
    ('HLCU', 'Hapag-Lloyd'), ('ONEY', 'ONE (Ocean Network Express)'), ('EGLV', 'Evergreen Line'),
    ('HDMU', 'HMM'), ('YMLU', 'Yang Ming'), ('ZIMU', 'ZIM'),
    ('PABV', 'PIL (Pacific International Lines)'), ('WHLC', 'Wan Hai Lines'), ('OOLU', 'OOCL'),
    ('020', 'Lufthansa Cargo'), ('176', 'Emirates SkyCargo'), ('157', 'Qatar Airways Cargo'),
    ('235', 'Turkish Cargo'), ('160', 'Cathay Cargo'), ('057', 'Air France Cargo'),
    ('074', 'KLM Cargo'), ('075', 'Iberia Cargo'), ('618', 'Singapore Airlines Cargo'),
    ('DBSR', 'DB Schenker'), ('DSVR', 'DSV Road')
) AS seed (code, label)
JOIN lookup_item i ON i.code = seed.code
JOIN lookup_category c ON c.id = i.category_id AND c.code = 'carrier'
CROSS JOIN (VALUES ('en-US'), ('es-ES')) AS locale (code)
ON CONFLICT (item_id, locale) DO NOTHING;
