-- ---------------------------------------------------------------------------
-- Temperature control and out-of-gauge cargo on a quote request
--
-- Both were flags with nowhere to put the answer. The form offered "temperature
-- control" and "out of gauge or heavy lift" as checkboxes and then showed a note
-- saying a specialist would call - so the customer told us something and we
-- stored nothing, and the pricer opened a request that said only "this is
-- complicated".
--
-- Both earn structure under the rule quote.schema.ts sets for leaving
-- `quote.payload`: a field leaves it when it is filtered, sorted or sent to
-- another system. A set point is on the reefer manifest; a heavy lift is quoted
-- per piece and the lifting equipment is ordered from it.
--
-- WHY TEMPERATURE IS A ROW AND OVERSIZE IS A LIST
--
-- A reefer booking carries one set point. Six nullable columns on `quote` would
-- be meaningless on every non-reefer request and would invite the question "why
-- is ventilation null here"; a row that exists or does not answers it. If a
-- request ever needs a different set point per container, this becomes a
-- nullable equipment_id - that is the seam, and it is deliberate.
--
-- Oversize is one row per piece because lifting equipment is quoted per piece.
-- Recording only the longest or heaviest is how a second crane goes unbooked.
-- ---------------------------------------------------------------------------

CREATE TABLE quote_temperature_control (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One per quote. UNIQUE rather than a column on `quote` so that the row's
  -- existence is the answer to "is this temperature controlled".
  quote_id   uuid NOT NULL UNIQUE REFERENCES quote (id) ON DELETE CASCADE,

  -- Celsius, and negative is ordinary: deep frozen runs at -25.
  set_point_celsius   numeric(5, 2) NOT NULL,
  -- Plus or minus. Zero is a real answer and means no tolerance at all.
  tolerance_celsius   numeric(5, 2),

  -- reefer_ventilation lookup code. Fresh-air exchange for respiring cargo.
  ventilation         varchar(20),
  -- Nitrogen or oxygen control for fruit. A yes or no, not a measurement.
  controlled_atmosphere boolean NOT NULL DEFAULT false,
  -- Whether the cargo must be at temperature before it is loaded.
  pre_cooling_required  boolean NOT NULL DEFAULT false,
  -- reefer_data_logger lookup code.
  data_logger         varchar(20),
  notes               varchar(400),

  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),

  -- Wider than any cargo we expect, narrow enough to catch a Fahrenheit value
  -- typed into a Celsius field.
  CONSTRAINT quote_temperature_set_point_range
    CHECK (set_point_celsius BETWEEN -70 AND 40),
  CONSTRAINT quote_temperature_tolerance_range
    CHECK (tolerance_celsius IS NULL OR tolerance_celsius BETWEEN 0 AND 30)
);

CREATE INDEX quote_temperature_control_quote_idx ON quote_temperature_control (quote_id);

COMMENT ON TABLE quote_temperature_control IS
  'Reefer settings for a quote. One row per quote; its existence is what makes the request temperature controlled.';
COMMENT ON COLUMN quote_temperature_control.tolerance_celsius IS
  'Plus or minus. Zero means no tolerance, which is different from not stated.';

CREATE TABLE quote_oversize_item (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id   uuid NOT NULL REFERENCES quote (id) ON DELETE CASCADE,
  position   integer NOT NULL,

  description varchar(240) NOT NULL,
  -- Centimetres, matching the cargo lines so nobody converts between screens.
  length_cm   numeric(10, 2) NOT NULL,
  width_cm    numeric(10, 2) NOT NULL,
  height_cm   numeric(10, 2) NOT NULL,
  weight_kg   numeric(12, 3) NOT NULL,
  -- lifting_method lookup code. What the piece needs to be moved with, which is
  -- the part that is quoted separately.
  lifting_method varchar(30),
  notes       varchar(400),

  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),

  CONSTRAINT quote_oversize_dimensions_positive
    CHECK (length_cm > 0 AND width_cm > 0 AND height_cm > 0),
  CONSTRAINT quote_oversize_weight_positive CHECK (weight_kg > 0)
);

CREATE UNIQUE INDEX quote_oversize_item_position_unique ON quote_oversize_item (quote_id, position);
CREATE INDEX quote_oversize_item_quote_idx ON quote_oversize_item (quote_id);

COMMENT ON TABLE quote_oversize_item IS
  'One row per oversized or heavy piece. Lifting equipment is quoted per piece, so the longest and heaviest alone are not enough.';

-- ---------------------------------------------------------------------------
-- Tenancy inherits from the parent quote, as every other quote child does.
-- ---------------------------------------------------------------------------

ALTER TABLE quote_temperature_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_temperature_control FORCE ROW LEVEL SECURITY;

CREATE POLICY quote_temperature_control_tenant_isolation ON quote_temperature_control
  USING (
    EXISTS (
      SELECT 1 FROM quote q
      WHERE q.id = quote_temperature_control.quote_id
        AND (q.customer_group_id = app.current_group() OR app.is_internal())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quote q
      WHERE q.id = quote_temperature_control.quote_id
        AND (q.customer_group_id = app.current_group() OR app.is_internal())
    )
  );

ALTER TABLE quote_oversize_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_oversize_item FORCE ROW LEVEL SECURITY;

CREATE POLICY quote_oversize_item_tenant_isolation ON quote_oversize_item
  USING (
    EXISTS (
      SELECT 1 FROM quote q
      WHERE q.id = quote_oversize_item.quote_id
        AND (q.customer_group_id = app.current_group() OR app.is_internal())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quote q
      WHERE q.id = quote_oversize_item.quote_id
        AND (q.customer_group_id = app.current_group() OR app.is_internal())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON quote_temperature_control TO portal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON quote_oversize_item TO portal_app;

-- ---------------------------------------------------------------------------
-- The option lists behind the two forms.
--
-- Seeded here rather than assumed, for the reason the container types taught us:
-- the lookup catalogue is loaded by a script, so a freshly migrated database has
-- none of it and a migration that only updated rows would match nothing.
-- ---------------------------------------------------------------------------

INSERT INTO lookup_category (code, name, description, ownership, default_locale, sort_order)
VALUES
  (
    'reefer_ventilation',
    'Reefer ventilation',
    'Fresh-air exchange setting for temperature-controlled cargo.',
    'portal', 'en-US', 67
  ),
  (
    'reefer_data_logger',
    'Reefer data loggers',
    'What records the temperature during transit.',
    'portal', 'en-US', 68
  ),
  (
    'lifting_method',
    'Lifting methods',
    'How an oversized or heavy piece is moved. Quoted per piece.',
    'portal', 'en-US', 69
  )
ON CONFLICT (code) DO NOTHING;

WITH seed (category_code, code, sort_order) AS (
  VALUES
    ('reefer_ventilation', 'CLOSED',     10),
    ('reefer_ventilation', 'VENT_10',    20),
    ('reefer_ventilation', 'VENT_25',    30),
    ('reefer_ventilation', 'VENT_50',    40),
    ('reefer_ventilation', 'FRESH_AIR',  50),

    ('reefer_data_logger', 'NONE',       10),
    ('reefer_data_logger', 'STANDARD',   20),
    ('reefer_data_logger', 'REAL_TIME',  30),

    ('lifting_method', 'FORKLIFT',        10),
    ('lifting_method', 'CRANE',           20),
    ('lifting_method', 'MOBILE_CRANE',    30),
    ('lifting_method', 'TWO_POINT_LIFT',  40),
    ('lifting_method', 'ROLL_ON_ROLL_OFF',50),
    ('lifting_method', 'CUSTOMER',        60)
)
INSERT INTO lookup_item (category_id, code, sort_order, is_active, is_customer_visible)
SELECT c.id, seed.code, seed.sort_order, true, true
FROM seed
JOIN lookup_category c ON c.code = seed.category_code
ON CONFLICT (category_id, code) DO NOTHING;

WITH labels (category_code, code, locale, label) AS (
  VALUES
    ('reefer_ventilation','CLOSED','en-US','Closed'),
    ('reefer_ventilation','CLOSED','es-ES','Cerrada'),
    ('reefer_ventilation','VENT_10','en-US','10 m³/h'),
    ('reefer_ventilation','VENT_10','es-ES','10 m³/h'),
    ('reefer_ventilation','VENT_25','en-US','25 m³/h'),
    ('reefer_ventilation','VENT_25','es-ES','25 m³/h'),
    ('reefer_ventilation','VENT_50','en-US','50 m³/h'),
    ('reefer_ventilation','VENT_50','es-ES','50 m³/h'),
    ('reefer_ventilation','FRESH_AIR','en-US','Fresh air, fully open'),
    ('reefer_ventilation','FRESH_AIR','es-ES','Aire fresco, totalmente abierta'),

    ('reefer_data_logger','NONE','en-US','Not required'),
    ('reefer_data_logger','NONE','es-ES','No necesario'),
    ('reefer_data_logger','STANDARD','en-US','Standard logger'),
    ('reefer_data_logger','STANDARD','es-ES','Registrador estándar'),
    ('reefer_data_logger','REAL_TIME','en-US','Real-time monitoring'),
    ('reefer_data_logger','REAL_TIME','es-ES','Seguimiento en tiempo real'),

    ('lifting_method','FORKLIFT','en-US','Forklift'),
    ('lifting_method','FORKLIFT','es-ES','Carretilla elevadora'),
    ('lifting_method','CRANE','en-US','Crane'),
    ('lifting_method','CRANE','es-ES','Grúa'),
    ('lifting_method','MOBILE_CRANE','en-US','Mobile crane'),
    ('lifting_method','MOBILE_CRANE','es-ES','Grúa móvil'),
    ('lifting_method','TWO_POINT_LIFT','en-US','Two-point lift'),
    ('lifting_method','TWO_POINT_LIFT','es-ES','Izado a dos puntos'),
    ('lifting_method','ROLL_ON_ROLL_OFF','en-US','Roll on, roll off'),
    ('lifting_method','ROLL_ON_ROLL_OFF','es-ES','Roll on, roll off'),
    ('lifting_method','CUSTOMER','en-US','Customer provides'),
    ('lifting_method','CUSTOMER','es-ES','Lo aporta el cliente')
)
INSERT INTO lookup_item_translation (item_id, locale, label)
SELECT i.id, labels.locale, labels.label
FROM labels
JOIN lookup_category c ON c.code = labels.category_code
JOIN lookup_item i ON i.category_id = c.id AND i.code = labels.code
ON CONFLICT (item_id, locale) DO NOTHING;
