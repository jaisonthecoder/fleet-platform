-- ---------------------------------------------------------------------------
-- Container equipment on a quote request
--
-- WHY THIS EXISTS
--
-- A full-container request is not a list of packages. The customer asks for
-- "two 40ft high cubes", and the pricer charges per container - `charge_basis`
-- already ships `PER_CONTAINER` as its first entry. Until now the form had only
-- loose cargo lines, so an FCL request had to be typed as packages, which is the
-- wrong shape for both of them: the customer describes something they did not
-- mean, and the pricer multiplies by a number that is not there.
--
-- WHY A TABLE
--
-- Same rule `quote.schema.ts` sets for leaving `quote.payload`: a field earns a
-- column when it is filtered, sorted or sent to another system. Equipment is
-- filtered ("how many 40HC did we quote this lane") and is what a per-container
-- charge multiplies by. It is also what a CargoWise booking carries, though that
-- path is not built yet and this does not claim it.
--
-- LOAD TYPE
--
-- `quote.load_type` is new and is what makes a request FCL rather than LCL.
-- `mode` could not carry it: mode is sea/air/road/rail, and FCL/LCL is a
-- different axis - a road request is FTL or LTL on the same distinction. The
-- codes come from the existing `load_type` lookup rather than a new enum, so the
-- business can retire one without a migration. Nullable, because an air request
-- has no load type at all.
-- ---------------------------------------------------------------------------

ALTER TABLE quote
  ADD COLUMN load_type varchar(8);

COMMENT ON COLUMN quote.load_type IS
  'load_type lookup code (FCL, LCL, FTL, LTL). Null for modes that have none, such as air.';

CREATE TABLE quote_equipment (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES quote (id) ON DELETE CASCADE,
  position    integer NOT NULL,

  -- Stable id within the request, in the SAME namespace as the `lineId` of a
  -- package line in quote.payload.packages. That is deliberate: a dangerous
  -- goods entry says which cargo it sits in, and on an FCL request that cargo is
  -- a container, not a package line. One namespace means `applies_to_lines`
  -- needs no second column and no discriminator.
  unit_id     varchar(64) NOT NULL,

  -- container_type lookup code, e.g. '40HC'. Free text against the lookup rather
  -- than an enum: ISO adds sizes and the business may want a type we have not
  -- seeded, and being blocked at 17:40 waiting for a migration is worse than a
  -- code we have to map later.
  container_type varchar(20) NOT NULL,
  quantity       integer NOT NULL,

  -- What the customer expects to load in each one. Not validated against the
  -- type's payload: the real limit is on the individual container's CSC plate,
  -- and road or rail legs often bind lower. The form warns; nothing refuses.
  gross_weight_per_unit_kg numeric(12, 3),

  notes      varchar(400),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),

  CONSTRAINT quote_equipment_quantity_positive CHECK (quantity > 0),
  CONSTRAINT quote_equipment_weight_positive
    CHECK (gross_weight_per_unit_kg IS NULL OR gross_weight_per_unit_kg > 0)
);

CREATE UNIQUE INDEX quote_equipment_position_unique ON quote_equipment (quote_id, position);
-- The uniqueness that matters: a dangerous goods entry resolves cargo by unit_id,
-- so two units sharing one id would make the hazard ambiguous.
CREATE UNIQUE INDEX quote_equipment_unit_unique ON quote_equipment (quote_id, unit_id);
CREATE INDEX quote_equipment_quote_idx ON quote_equipment (quote_id);
CREATE INDEX quote_equipment_type_idx ON quote_equipment (container_type);

COMMENT ON TABLE quote_equipment IS
  'Containers requested on a quote. One row per container type; quantity carries the count.';
COMMENT ON COLUMN quote_equipment.unit_id IS
  'Shares a namespace with payload.packages[].lineId so quote_dangerous_goods.applies_to_lines can name either.';

ALTER TABLE quote_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_equipment FORCE ROW LEVEL SECURITY;

CREATE POLICY quote_equipment_tenant_isolation ON quote_equipment
  USING (
    EXISTS (
      SELECT 1 FROM quote q
      WHERE q.id = quote_equipment.quote_id
        AND (q.customer_group_id = app.current_group() OR app.is_internal())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quote q
      WHERE q.id = quote_equipment.quote_id
        AND (q.customer_group_id = app.current_group() OR app.is_internal())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON quote_equipment TO portal_app;

-- ---------------------------------------------------------------------------
-- Container types, and the figures the picker needs.
--
-- Seeded HERE rather than assumed. `container_type` is part of the lookup
-- catalogue, which `pnpm db:seed:lookups` loads - a script, not a migration. So
-- a freshly migrated database has no container types at all, and a migration
-- that only UPDATEs metadata would match nothing and leave the picker empty with
-- no error. Inserting them makes this migration true on its own; ON CONFLICT
-- keeps it harmless where the seed already ran.
--
-- Structured metadata, not prose, so the screen can format and translate it.
-- Dimensions are internal, in metres; capacity is usable volume in cubic metres.
--
-- `maxPayloadKg` is INDICATIVE. The binding figure is on the individual
-- container's CSC plate and varies by build, and a road or rail leg often limits
-- the load below it. The form uses these to warn, never to refuse - which is why
-- they live in metadata an administrator can correct rather than in a CHECK.
-- ---------------------------------------------------------------------------

INSERT INTO lookup_category (code, name, description, ownership, default_locale, sort_order)
VALUES (
  'container_type',
  'Container types',
  'Shipping container sizes and types offered on a full-container request.',
  'portal', 'en-US', 66
)
ON CONFLICT (code) DO NOTHING;

WITH figures (code, en, es, sort_order, meta) AS (
  VALUES
    ('20GP', '20ft general purpose',  'Contenedor estándar 20 pies',      10, '{"group":"dry","teu":1,"maxPayloadKg":28100,"capacityM3":33,"lengthM":5.90,"widthM":2.35,"heightM":2.39}'),
    ('40GP', '40ft general purpose',  'Contenedor estándar 40 pies',      20, '{"group":"dry","teu":2,"maxPayloadKg":26700,"capacityM3":67,"lengthM":12.03,"widthM":2.35,"heightM":2.39}'),
    ('40HC', '40ft high cube',        'Contenedor high cube 40 pies',     30, '{"group":"dry","teu":2,"maxPayloadKg":26500,"capacityM3":76,"lengthM":12.03,"widthM":2.35,"heightM":2.69}'),
    ('45HC', '45ft high cube',        'Contenedor high cube 45 pies',     40, '{"group":"dry","teu":2,"maxPayloadKg":27600,"capacityM3":86,"lengthM":13.56,"widthM":2.35,"heightM":2.69}'),
    ('20RF', '20ft reefer',           'Contenedor refrigerado 20 pies',   50, '{"group":"reefer","teu":1,"maxPayloadKg":27400,"capacityM3":28,"lengthM":5.44,"widthM":2.29,"heightM":2.27}'),
    ('40RF', '40ft reefer',           'Contenedor refrigerado 40 pies',   60, '{"group":"reefer","teu":2,"maxPayloadKg":27700,"capacityM3":59,"lengthM":11.56,"widthM":2.29,"heightM":2.25}'),
    ('40RH', '40ft reefer high cube', 'Refrigerado high cube 40 pies',    70, '{"group":"reefer","teu":2,"maxPayloadKg":27700,"capacityM3":67,"lengthM":11.56,"widthM":2.29,"heightM":2.50}'),
    ('20OT', '20ft open top',         'Contenedor open top 20 pies',      80, '{"group":"special","teu":1,"maxPayloadKg":28100,"capacityM3":32,"lengthM":5.89,"widthM":2.34,"heightM":2.31}'),
    ('40OT', '40ft open top',         'Contenedor open top 40 pies',      90, '{"group":"special","teu":2,"maxPayloadKg":26600,"capacityM3":65,"lengthM":12.02,"widthM":2.34,"heightM":2.31}'),
    ('20FR', '20ft flat rack',        'Plataforma flat rack 20 pies',    100, '{"group":"special","teu":1,"maxPayloadKg":31200,"lengthM":5.94,"widthM":2.35}'),
    ('40FR', '40ft flat rack',        'Plataforma flat rack 40 pies',    110, '{"group":"special","teu":2,"maxPayloadKg":39700,"lengthM":12.13,"widthM":2.40}'),
    ('20TK', '20ft tank',             'Contenedor cisterna 20 pies',     120, '{"group":"special","teu":1,"maxPayloadKg":26000,"capacityM3":24}')
)
INSERT INTO lookup_item (category_id, code, sort_order, is_active, is_customer_visible, metadata)
SELECT c.id, figures.code, figures.sort_order, true, true, figures.meta::jsonb
FROM figures
JOIN lookup_category c ON c.code = 'container_type'
ON CONFLICT (category_id, code) DO NOTHING;

-- Applied separately so an existing catalogue gains the figures too: the insert
-- above does nothing where the seed already created the row.
WITH figures (code, meta) AS (
  VALUES
    ('20GP', '{"group":"dry","teu":1,"maxPayloadKg":28100,"capacityM3":33,"lengthM":5.90,"widthM":2.35,"heightM":2.39}'),
    ('40GP', '{"group":"dry","teu":2,"maxPayloadKg":26700,"capacityM3":67,"lengthM":12.03,"widthM":2.35,"heightM":2.39}'),
    ('40HC', '{"group":"dry","teu":2,"maxPayloadKg":26500,"capacityM3":76,"lengthM":12.03,"widthM":2.35,"heightM":2.69}'),
    ('45HC', '{"group":"dry","teu":2,"maxPayloadKg":27600,"capacityM3":86,"lengthM":13.56,"widthM":2.35,"heightM":2.69}'),
    ('20RF', '{"group":"reefer","teu":1,"maxPayloadKg":27400,"capacityM3":28,"lengthM":5.44,"widthM":2.29,"heightM":2.27}'),
    ('40RF', '{"group":"reefer","teu":2,"maxPayloadKg":27700,"capacityM3":59,"lengthM":11.56,"widthM":2.29,"heightM":2.25}'),
    ('40RH', '{"group":"reefer","teu":2,"maxPayloadKg":27700,"capacityM3":67,"lengthM":11.56,"widthM":2.29,"heightM":2.50}'),
    ('20OT', '{"group":"special","teu":1,"maxPayloadKg":28100,"capacityM3":32,"lengthM":5.89,"widthM":2.34,"heightM":2.31}'),
    ('40OT', '{"group":"special","teu":2,"maxPayloadKg":26600,"capacityM3":65,"lengthM":12.02,"widthM":2.34,"heightM":2.31}'),
    ('20FR', '{"group":"special","teu":1,"maxPayloadKg":31200,"lengthM":5.94,"widthM":2.35}'),
    ('40FR', '{"group":"special","teu":2,"maxPayloadKg":39700,"lengthM":12.13,"widthM":2.40}'),
    ('20TK', '{"group":"special","teu":1,"maxPayloadKg":26000,"capacityM3":24}')
)
UPDATE lookup_item i
SET metadata = figures.meta::jsonb
FROM figures, lookup_category c
WHERE c.code = 'container_type'
  AND i.category_id = c.id
  AND i.code = figures.code;

WITH labels (code, locale, label) AS (
  VALUES
    ('20GP','en-US','20ft general purpose'),  ('20GP','es-ES','Contenedor estándar 20 pies'),
    ('40GP','en-US','40ft general purpose'),  ('40GP','es-ES','Contenedor estándar 40 pies'),
    ('40HC','en-US','40ft high cube'),        ('40HC','es-ES','Contenedor high cube 40 pies'),
    ('45HC','en-US','45ft high cube'),        ('45HC','es-ES','Contenedor high cube 45 pies'),
    ('20RF','en-US','20ft reefer'),           ('20RF','es-ES','Contenedor refrigerado 20 pies'),
    ('40RF','en-US','40ft reefer'),           ('40RF','es-ES','Contenedor refrigerado 40 pies'),
    ('40RH','en-US','40ft reefer high cube'), ('40RH','es-ES','Refrigerado high cube 40 pies'),
    ('20OT','en-US','20ft open top'),         ('20OT','es-ES','Contenedor open top 20 pies'),
    ('40OT','en-US','40ft open top'),         ('40OT','es-ES','Contenedor open top 40 pies'),
    ('20FR','en-US','20ft flat rack'),        ('20FR','es-ES','Plataforma flat rack 20 pies'),
    ('40FR','en-US','40ft flat rack'),        ('40FR','es-ES','Plataforma flat rack 40 pies'),
    ('20TK','en-US','20ft tank'),             ('20TK','es-ES','Contenedor cisterna 20 pies')
)
INSERT INTO lookup_item_translation (item_id, locale, label)
SELECT i.id, labels.locale, labels.label
FROM labels
JOIN lookup_category c ON c.code = 'container_type'
JOIN lookup_item i ON i.category_id = c.id AND i.code = labels.code
ON CONFLICT (item_id, locale) DO NOTHING;
