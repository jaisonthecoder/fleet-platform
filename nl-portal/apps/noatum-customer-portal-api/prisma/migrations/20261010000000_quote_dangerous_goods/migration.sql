-- ---------------------------------------------------------------------------
-- Dangerous goods on a quote request
--
-- WHAT THIS IS, AND DELIBERATELY IS NOT
--
-- This captures dangerous-goods DATA so a pricing specialist can price and a
-- carrier can be asked whether it will accept. It is NOT a dangerous goods
-- declaration. The declaration is the shipper's signed certification that the
-- goods are correctly classified, packed, marked and labelled under the
-- applicable regulations; producing one needs the current IMDG or IATA edition,
-- its dangerous goods list, packing instructions and quantity limits. We hold
-- none of those, and CargoWise is the system of record for the documentation.
--
-- docs/research/06-Freight-Forwarding-and-Quotation-Research.md says it plainly:
-- "A price request is not a dangerous-goods declaration and does not authorise
-- physical transport", and DG details at quote stage need only be "sufficient
-- for specialist pricing".
--
-- WHY A TABLE AND NOT MORE JSON
--
-- quote.payload holds the long tail of a request, and quote.schema.ts sets the
-- bar for leaving it: a field earns a column when it is filtered, sorted or sent
-- to another system. Dangerous goods clears that bar three times over - it goes
-- to CargoWise, ops must be able to ask "which live quotes carry class 3", and
-- a hazard buried in a JSON blob is a hazard nobody can query.
--
-- ONE ROW PER UN NUMBER AND PACKAGING VARIANT
--
-- Not one per quote. The same research warns against flattening a mixed
-- consignment to a single UN number: "maintain repeatable classification details
-- rather than one UN number for the entire quote". Two UN numbers in one
-- container is the ordinary case, not the exception.
--
-- WHAT IS REQUIRED
--
-- UN number and class only. That is FR-QTE-002, and stage 08 of the phase plan
-- is explicit that "additional dangerous-goods fields from research require
-- approval before becoming mandatory". Every other column here is nullable on
-- purpose: it is captured when the customer knows it, and its absence is the
-- specialist's cue to ask, not a reason to refuse the request.
-- ---------------------------------------------------------------------------

CREATE TABLE quote_dangerous_goods (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id       uuid NOT NULL REFERENCES quote (id) ON DELETE CASCADE,
  position       integer NOT NULL,

  -- The two required fields. Four characters because UN numbers are four digits
  -- and we store them as typed rather than as an integer: leading zeros matter
  -- in print, and "0004" is not 4.
  un_number      varchar(4) NOT NULL,
  -- Class or division, e.g. '3', '2.1', '5.2'. Free text against the
  -- hazard_class lookup rather than an enum, because divisions change between
  -- editions and an enum would need a migration to follow them.
  hazard_class   varchar(8) NOT NULL,

  -- Everything below is optional pending the approval recorded in docs/gaps.md.
  proper_shipping_name varchar(240),
  -- A second hazard the substance also presents. Rarely more than one in
  -- practice, but stored as an array because some entries carry two.
  subsidiary_risks     text[] NOT NULL DEFAULT '{}',
  -- I, II or III. Not every dangerous good has one - class 2 gases and class 7
  -- never do - so this is nullable and must stay that way.
  packing_group        varchar(4),
  -- Required in the regulations when the proper shipping name is "n.o.s."
  -- (not otherwise specified). We do not enforce that: we are not the authority
  -- on which names are n.o.s. entries.
  technical_name       varchar(240),
  -- Drives sea stowage category for flammable liquids.
  flashpoint_celsius   numeric(6, 2),
  -- IMDG emergency schedule, e.g. 'F-E, S-E'.
  ems_code             varchar(40),
  -- Triggers extra marking and, for some lanes, extra cost.
  is_marine_pollutant  boolean NOT NULL DEFAULT false,

  packaging_type       varchar(80),
  -- UN packaging code such as 1A1 or 4G. Identifies the tested packaging.
  un_packaging_code    varchar(20),
  package_count        integer,
  net_quantity_per_package numeric(12, 3),
  -- kg, L or Wh. Wh because lithium batteries are measured in watt-hours.
  quantity_unit        varchar(8),
  -- Full DG, limited quantity or excepted quantity. The relief changes what is
  -- required downstream, so a specialist needs to know which one is claimed.
  transport_regime     varchar(40),
  is_in_overpack       boolean NOT NULL DEFAULT false,

  -- Which cargo this entry sits in.
  --
  -- These are the `lineId` values of entries in quote.payload.packages. A text
  -- array rather than a foreign key because cargo lines do not have a table yet;
  -- the service validates every id against the submitted lines in the same
  -- transaction, so an orphan cannot be written. When cargo lines earn a table
  -- this becomes a real link table - that is the seam, and it is deliberate.
  --
  -- It matters more than it looks. An entry linked to nothing means nobody knows
  -- which container holds the hazard, which is the precise shape of a
  -- misdeclaration.
  applies_to_lines     text[] NOT NULL DEFAULT '{}',

  notes          varchar(2000),
  created_at     timestamptz(6) NOT NULL DEFAULT now(),
  updated_at     timestamptz(6) NOT NULL DEFAULT now(),

  CONSTRAINT quote_dangerous_goods_un_number_shape
    CHECK (un_number ~ '^[0-9]{4}$'),
  CONSTRAINT quote_dangerous_goods_counts_positive
    CHECK (package_count IS NULL OR package_count > 0),
  CONSTRAINT quote_dangerous_goods_quantity_positive
    CHECK (net_quantity_per_package IS NULL OR net_quantity_per_package > 0)
);

CREATE UNIQUE INDEX quote_dangerous_goods_position_unique
  ON quote_dangerous_goods (quote_id, position);
CREATE INDEX quote_dangerous_goods_quote_idx ON quote_dangerous_goods (quote_id);
-- Ops asks "what class 3 is moving through this branch this week". Without this
-- that question is a sequential scan of every quote ever raised.
CREATE INDEX quote_dangerous_goods_class_idx ON quote_dangerous_goods (hazard_class);
CREATE INDEX quote_dangerous_goods_un_idx ON quote_dangerous_goods (un_number);

COMMENT ON TABLE quote_dangerous_goods IS
  'Dangerous goods data captured with a quote request. NOT a dangerous goods declaration: the declaration is the shipper''s signed certification and CargoWise owns it.';
COMMENT ON COLUMN quote_dangerous_goods.applies_to_lines IS
  'lineId values from quote.payload.packages. Validated by the service on write; becomes a real link table when cargo lines get their own table.';

-- ---------------------------------------------------------------------------
-- Tenancy inherits from the parent quote, exactly as quote_option does. No
-- denormalised customer_group_id: one owner of the truth, and a child row can
-- never drift from the quote it belongs to.
-- ---------------------------------------------------------------------------

ALTER TABLE quote_dangerous_goods ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_dangerous_goods FORCE ROW LEVEL SECURITY;

CREATE POLICY quote_dangerous_goods_tenant_isolation ON quote_dangerous_goods
  USING (
    EXISTS (
      SELECT 1 FROM quote q
      WHERE q.id = quote_dangerous_goods.quote_id
        AND (q.customer_group_id = app.current_group() OR app.is_internal())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quote q
      WHERE q.id = quote_dangerous_goods.quote_id
        AND (q.customer_group_id = app.current_group() OR app.is_internal())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON quote_dangerous_goods TO portal_app;

-- ---------------------------------------------------------------------------
-- The option lists behind the form.
--
-- Values come from lookups so the business can maintain them, and because the
-- regulations they mirror are revised on a fixed cycle - IMDG every two years,
-- the IATA DGR every January. A TypeScript constant would mean a deployment
-- every time an edition lands.
--
-- hazard_class already exists with the 25 UN classes and divisions; nothing to
-- add there.
-- ---------------------------------------------------------------------------

INSERT INTO lookup_category (code, name, description, ownership, default_locale, sort_order)
VALUES
  (
    'dg_packing_group',
    'Packing groups',
    'Degree of danger within a class. Not every dangerous good has one.',
    'portal', 'en-US', 62
  ),
  (
    'dg_packaging_type',
    'Dangerous goods packaging',
    'The kind of packaging a dangerous good travels in. Offered on the quote request; the customer may still type another.',
    'portal', 'en-US', 63
  ),
  (
    'dg_transport_regime',
    'Dangerous goods regimes',
    'Whether the entry travels as full dangerous goods or under a limited or excepted quantity relief.',
    'portal', 'en-US', 64
  ),
  (
    'dg_quantity_unit',
    'Dangerous goods quantity units',
    'How a dangerous goods net quantity is measured.',
    'portal', 'en-US', 65
  )
ON CONFLICT (code) DO NOTHING;

WITH seed (category_code, code, en, es, sort_order) AS (
  VALUES
    ('dg_packing_group',   'I',                'I - high danger',            'I - peligro alto',              10),
    ('dg_packing_group',   'II',               'II - medium danger',         'II - peligro medio',            20),
    ('dg_packing_group',   'III',              'III - low danger',           'III - peligro bajo',            30),
    ('dg_packing_group',   'NONE',             'Not assigned',               'No asignado',                   40),

    ('dg_packaging_type',  'STEEL_DRUM',       'Steel drum',                 'Bidón de acero',                10),
    ('dg_packaging_type',  'PLASTIC_DRUM',     'Plastic drum',               'Bidón de plástico',             20),
    ('dg_packaging_type',  'FIBRE_DRUM',       'Fibre drum',                 'Bidón de fibra',                30),
    ('dg_packaging_type',  'JERRICAN',         'Jerrican',                   'Jerricán',                      40),
    ('dg_packaging_type',  'FIBREBOARD_BOX',   'Fibreboard box',             'Caja de cartón',                50),
    ('dg_packaging_type',  'WOODEN_CRATE',     'Wooden crate',               'Caja de madera',                60),
    ('dg_packaging_type',  'IBC',              'IBC',                        'GRG',                           70),
    ('dg_packaging_type',  'GAS_CYLINDER',     'Gas cylinder',               'Botella de gas',                80),
    ('dg_packaging_type',  'TANK',             'Tank',                       'Cisterna',                      90),
    ('dg_packaging_type',  'BAG',              'Bag',                        'Saco',                         100),

    ('dg_transport_regime', 'FULL',            'Full dangerous goods',       'Mercancías peligrosas completas', 10),
    ('dg_transport_regime', 'LIMITED_QUANTITY', 'Limited quantity',          'Cantidad limitada',             20),
    ('dg_transport_regime', 'EXCEPTED_QUANTITY', 'Excepted quantity',        'Cantidad exceptuada',           30),

    ('dg_quantity_unit',   'KG',               'kg',                         'kg',                            10),
    ('dg_quantity_unit',   'L',                'L',                          'L',                             20),
    ('dg_quantity_unit',   'WH',               'Wh',                         'Wh',                            30)
)
INSERT INTO lookup_item (category_id, code, sort_order, is_active, is_customer_visible)
SELECT c.id, seed.code, seed.sort_order, true, true
FROM seed
JOIN lookup_category c ON c.code = seed.category_code
ON CONFLICT (category_id, code) DO NOTHING;

WITH seed (category_code, code, locale, label) AS (
  VALUES
    ('dg_packing_group', 'I',   'en-US', 'I - high danger'),
    ('dg_packing_group', 'I',   'es-ES', 'I - peligro alto'),
    ('dg_packing_group', 'II',  'en-US', 'II - medium danger'),
    ('dg_packing_group', 'II',  'es-ES', 'II - peligro medio'),
    ('dg_packing_group', 'III', 'en-US', 'III - low danger'),
    ('dg_packing_group', 'III', 'es-ES', 'III - peligro bajo'),
    ('dg_packing_group', 'NONE', 'en-US', 'Not assigned'),
    ('dg_packing_group', 'NONE', 'es-ES', 'No asignado'),

    ('dg_packaging_type', 'STEEL_DRUM',     'en-US', 'Steel drum'),
    ('dg_packaging_type', 'STEEL_DRUM',     'es-ES', 'Bidón de acero'),
    ('dg_packaging_type', 'PLASTIC_DRUM',   'en-US', 'Plastic drum'),
    ('dg_packaging_type', 'PLASTIC_DRUM',   'es-ES', 'Bidón de plástico'),
    ('dg_packaging_type', 'FIBRE_DRUM',     'en-US', 'Fibre drum'),
    ('dg_packaging_type', 'FIBRE_DRUM',     'es-ES', 'Bidón de fibra'),
    ('dg_packaging_type', 'JERRICAN',       'en-US', 'Jerrican'),
    ('dg_packaging_type', 'JERRICAN',       'es-ES', 'Jerricán'),
    ('dg_packaging_type', 'FIBREBOARD_BOX', 'en-US', 'Fibreboard box'),
    ('dg_packaging_type', 'FIBREBOARD_BOX', 'es-ES', 'Caja de cartón'),
    ('dg_packaging_type', 'WOODEN_CRATE',   'en-US', 'Wooden crate'),
    ('dg_packaging_type', 'WOODEN_CRATE',   'es-ES', 'Caja de madera'),
    ('dg_packaging_type', 'IBC',            'en-US', 'IBC'),
    ('dg_packaging_type', 'IBC',            'es-ES', 'GRG'),
    ('dg_packaging_type', 'GAS_CYLINDER',   'en-US', 'Gas cylinder'),
    ('dg_packaging_type', 'GAS_CYLINDER',   'es-ES', 'Botella de gas'),
    ('dg_packaging_type', 'TANK',           'en-US', 'Tank'),
    ('dg_packaging_type', 'TANK',           'es-ES', 'Cisterna'),
    ('dg_packaging_type', 'BAG',            'en-US', 'Bag'),
    ('dg_packaging_type', 'BAG',            'es-ES', 'Saco'),

    ('dg_transport_regime', 'FULL',              'en-US', 'Full dangerous goods'),
    ('dg_transport_regime', 'FULL',              'es-ES', 'Mercancías peligrosas completas'),
    ('dg_transport_regime', 'LIMITED_QUANTITY',  'en-US', 'Limited quantity'),
    ('dg_transport_regime', 'LIMITED_QUANTITY',  'es-ES', 'Cantidad limitada'),
    ('dg_transport_regime', 'EXCEPTED_QUANTITY', 'en-US', 'Excepted quantity'),
    ('dg_transport_regime', 'EXCEPTED_QUANTITY', 'es-ES', 'Cantidad exceptuada'),

    ('dg_quantity_unit', 'KG', 'en-US', 'kg'),
    ('dg_quantity_unit', 'KG', 'es-ES', 'kg'),
    ('dg_quantity_unit', 'L',  'en-US', 'L'),
    ('dg_quantity_unit', 'L',  'es-ES', 'L'),
    ('dg_quantity_unit', 'WH', 'en-US', 'Wh'),
    ('dg_quantity_unit', 'WH', 'es-ES', 'Wh')
)
INSERT INTO lookup_item_translation (item_id, locale, label)
SELECT i.id, seed.locale, seed.label
FROM seed
JOIN lookup_category c ON c.code = seed.category_code
JOIN lookup_item i ON i.category_id = c.id AND i.code = seed.code
ON CONFLICT (item_id, locale) DO NOTHING;
