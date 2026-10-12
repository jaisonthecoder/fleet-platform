-- ---------------------------------------------------------------------------
-- Service selection becomes lookup-driven
--
-- The quote request screen chose a transport mode and a load type from arrays
-- hard-coded in the React page, including which load types belong to which mode.
-- So "rail" appeared on a customer screen because a TypeScript array said so,
-- and nobody at Noatum could remove it without a deployment.
--
-- Everything the screen needs now comes from the two lookups it already had:
--   * the list of modes offered            -> lookup_item.is_active / is_customer_visible
--   * the label under each mode card       -> lookup_item_translation.description
--   * which load types apply to a mode     -> lookup_item.metadata.modes
--
-- `metadata.modes` is the same filtering hint ReferenceService already applies to
-- carriers, so no new mechanism is introduced. It narrows what is OFFERED; it is
-- never a validation, because an administrator can edit it.
--
-- Deliberately NOT moved into data: whether a load type means containers rather
-- than package lines. The API already enforces "FCL or FTL implies at least one
-- container", so a second, editable copy of that rule would drift from the one
-- the server applies.
--
-- The categories and items are inserted before being updated: `db:seed:lookups`
-- is a script, not a migration, so a freshly migrated database has neither.
-- ---------------------------------------------------------------------------

INSERT INTO lookup_category (code, name, description, ownership, default_locale, sort_order)
VALUES
  (
    'transport_mode',
    'Transport modes',
    'Mirrors the TransportMode enum. Adding a mode is a code change; whether a mode is OFFERED is this list.',
    'system',
    'en-US',
    500
  ),
  (
    'load_type',
    'Load types',
    'Whether a shipment fills its equipment or is consolidated.',
    'portal',
    'en-US',
    110
  )
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Modes
-- ---------------------------------------------------------------------------

WITH category AS (SELECT id FROM lookup_category WHERE code = 'transport_mode'),
seed (code, sort_order) AS (
  VALUES ('sea', 10), ('air', 20), ('road', 30), ('rail', 40)
)
INSERT INTO lookup_item (category_id, code, sort_order, is_active, is_customer_visible)
SELECT category.id, seed.code, seed.sort_order, true, true
FROM seed CROSS JOIN category
ON CONFLICT (category_id, code) DO NOTHING;

-- A customer cannot request a mode that is not offered to customers.
-- The order is set rather than inserted: the rows usually already exist from the
-- seed script, all with sort_order 0, which left the cards in an arbitrary order
-- and made whichever sorted first the default choice.
UPDATE lookup_item i
SET is_customer_visible = true, sort_order = seed.sort_order
FROM (VALUES ('sea', 10), ('air', 20), ('road', 30), ('rail', 40)) AS seed (code, sort_order),
lookup_category c
WHERE c.id = i.category_id AND c.code = 'transport_mode' AND i.code = seed.code;

INSERT INTO lookup_item_translation (item_id, locale, label, description)
SELECT i.id, seed.locale, seed.label, seed.description
FROM (
  VALUES
    ('sea',  'en-US', 'Sea',   'Container or groupage'),
    ('sea',  'es-ES', 'Marítimo', 'Contenedor o grupaje'),
    ('air',  'en-US', 'Air',   'Airport or door'),
    ('air',  'es-ES', 'Aéreo', 'Aeropuerto o domicilio'),
    ('road', 'en-US', 'Road',  'Truck or groupage'),
    ('road', 'es-ES', 'Carretera', 'Camión o grupaje'),
    ('rail', 'en-US', 'Rail',  'Block or wagon load'),
    ('rail', 'es-ES', 'Ferrocarril', 'Tren completo o por vagones')
) AS seed (code, locale, label, description)
JOIN lookup_item i ON i.code = seed.code
JOIN lookup_category c ON c.id = i.category_id AND c.code = 'transport_mode'
ON CONFLICT (item_id, locale) DO NOTHING;

-- The rows usually already exist from the seed script with no description, which
-- is the whole point of this migration, so fill it in without touching labels an
-- administrator may have corrected.
UPDATE lookup_item_translation t
SET description = seed.description
FROM (
  VALUES
    ('sea',  'en-US', 'Container or groupage'),
    ('sea',  'es-ES', 'Contenedor o grupaje'),
    ('air',  'en-US', 'Airport or door'),
    ('air',  'es-ES', 'Aeropuerto o domicilio'),
    ('road', 'en-US', 'Truck or groupage'),
    ('road', 'es-ES', 'Camión o grupaje'),
    ('rail', 'en-US', 'Block or wagon load'),
    ('rail', 'es-ES', 'Tren completo o por vagones')
) AS seed (code, locale, description)
JOIN lookup_item i ON i.code = seed.code
JOIN lookup_category c ON c.id = i.category_id AND c.code = 'transport_mode'
WHERE t.item_id = i.id AND t.locale = seed.locale AND t.description IS NULL;

-- ---------------------------------------------------------------------------
-- Load types, and which mode each belongs to
-- ---------------------------------------------------------------------------

WITH category AS (SELECT id FROM lookup_category WHERE code = 'load_type'),
seed (code, sort_order) AS (
  VALUES ('FCL', 10), ('LCL', 20), ('FTL', 30), ('LTL', 40)
)
INSERT INTO lookup_item (category_id, code, sort_order, is_active, is_customer_visible)
SELECT category.id, seed.code, seed.sort_order, true, true
FROM seed CROSS JOIN category
ON CONFLICT (category_id, code) DO NOTHING;

-- FCL/LCL are sea containers and FTL/LTL are trucking, which is forwarding
-- practice rather than a Noatum preference — but it is recorded as data so a
-- region that sells rail groupage can widen it without a release.
UPDATE lookup_item i
SET
  is_customer_visible = true,
  sort_order = seed.sort_order,
  metadata = COALESCE(i.metadata, '{}'::jsonb) || jsonb_build_object('modes', seed.modes)
FROM (
  VALUES
    ('FCL', '["sea"]'::jsonb, 10),
    ('LCL', '["sea"]'::jsonb, 20),
    ('FTL', '["road","rail"]'::jsonb, 30),
    ('LTL', '["road","rail"]'::jsonb, 40)
) AS seed (code, modes, sort_order),
lookup_category c
WHERE c.id = i.category_id AND c.code = 'load_type' AND i.code = seed.code;

INSERT INTO lookup_item_translation (item_id, locale, label, description)
SELECT i.id, seed.locale, seed.label, seed.description
FROM (
  VALUES
    ('FCL', 'en-US', 'Full container load',        'Full container'),
    ('FCL', 'es-ES', 'Contenedor completo',        'Contenedor completo'),
    ('LCL', 'en-US', 'Less than container load',   'Shared container'),
    ('LCL', 'es-ES', 'Grupaje marítimo',           'Contenedor compartido'),
    ('FTL', 'en-US', 'Full truck load',            'Full truck'),
    ('FTL', 'es-ES', 'Camión completo',            'Camión completo'),
    ('LTL', 'en-US', 'Less than truck load',       'Shared truck'),
    ('LTL', 'es-ES', 'Grupaje terrestre',          'Camión compartido')
) AS seed (code, locale, label, description)
JOIN lookup_item i ON i.code = seed.code
JOIN lookup_category c ON c.id = i.category_id AND c.code = 'load_type'
ON CONFLICT (item_id, locale) DO NOTHING;

UPDATE lookup_item_translation t
SET description = seed.description
FROM (
  VALUES
    ('FCL', 'en-US', 'Full container'),
    ('FCL', 'es-ES', 'Contenedor completo'),
    ('LCL', 'en-US', 'Shared container'),
    ('LCL', 'es-ES', 'Contenedor compartido'),
    ('FTL', 'en-US', 'Full truck'),
    ('FTL', 'es-ES', 'Camión completo'),
    ('LTL', 'en-US', 'Shared truck'),
    ('LTL', 'es-ES', 'Camión compartido')
) AS seed (code, locale, description)
JOIN lookup_item i ON i.code = seed.code
JOIN lookup_category c ON c.id = i.category_id AND c.code = 'load_type'
WHERE t.item_id = i.id AND t.locale = seed.locale AND t.description IS NULL;
