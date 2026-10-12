-- ---------------------------------------------------------------------------
-- C4 - manual pricing
--
-- A quote carries one or more OPTIONS, each with CHARGE LINES. Every field a
-- person types; nothing here derives, compares or ranks anything. There is no
-- rate table, no tariff, and no charge-code catalogue - the code column is free
-- text with a hint list, which is what makes the screen feel like a spreadsheet
-- rather than a data-entry form (director, 17.09.2026).
--
-- Three tables, and the third is the interesting one.
-- ---------------------------------------------------------------------------

CREATE TABLE quote_option (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id         uuid NOT NULL REFERENCES quote (id) ON DELETE CASCADE,
  -- Display order as the pricer arranged it. "Option 1" on the screen is this,
  -- not the insertion order and not the cheapest.
  position         integer NOT NULL,
  name             varchar(120),
  -- Free text. No carrier catalogue exists, and inventing one here would make
  -- the pricer stop and look something up.
  carrier_name     varchar(160),
  service_routing  varchar(240),
  transit_days_min integer,
  transit_days_max integer,
  next_departures  varchar(120),
  free_time_days   integer,
  -- Minor units. Never a float. Maintained as the sum of the charge lines by
  -- the service, which is also the only thing allowed to write it.
  total_minor_units bigint,
  currency         char(3),
  valid_until      timestamptz(6),
  is_recommended   boolean NOT NULL DEFAULT false,
  notes            text,
  -- The four quotation-terms blocks from the pricing screen. Free text, because
  -- every branch words them differently and no standard exists to enforce.
  terms_included     text,
  terms_excluded     text,
  terms_payment      varchar(400),
  terms_subject_to   varchar(400),
  created_at       timestamptz(6) NOT NULL DEFAULT now(),
  updated_at       timestamptz(6) NOT NULL DEFAULT now(),

  CONSTRAINT quote_option_transit_days_ordered
    CHECK (transit_days_min IS NULL OR transit_days_max IS NULL OR transit_days_min <= transit_days_max)
);

CREATE UNIQUE INDEX quote_option_position_unique ON quote_option (quote_id, position);
CREATE INDEX quote_option_quote_idx ON quote_option (quote_id);

-- At most one recommendation per quote. The screen offers a single "Recommended
-- to customer" toggle, and two recommendations is not a stricter recommendation,
-- it is a bug that reaches the customer as a contradiction.
CREATE UNIQUE INDEX quote_option_single_recommendation
  ON quote_option (quote_id)
  WHERE is_recommended;

CREATE TABLE quote_charge_line (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_option_id   uuid NOT NULL REFERENCES quote_option (id) ON DELETE CASCADE,
  position          integer NOT NULL,
  -- Free text with a hint list in the UI. NOT a foreign key to a charge-code
  -- table, because no such table exists and the business has no standard set.
  code              varchar(40),
  description       varchar(240) NOT NULL,
  -- "Per container", "Per shipment", "Per B/L". Free text for the same reason.
  basis             varchar(60),
  quantity          numeric(12, 3) NOT NULL DEFAULT 1,
  rate_minor_units  bigint NOT NULL DEFAULT 0,
  currency          char(3) NOT NULL,
  -- Stored, not derived on read, because this figure appears on a PDF a customer
  -- keeps. It is written by the service as quantity x rate; the column exists so
  -- that what we showed and what we sent can never disagree later.
  amount_minor_units bigint NOT NULL DEFAULT 0,
  created_at        timestamptz(6) NOT NULL DEFAULT now(),
  updated_at        timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX quote_charge_line_position_unique
  ON quote_charge_line (quote_option_id, position);
CREATE INDEX quote_charge_line_option_idx ON quote_charge_line (quote_option_id);

-- ---------------------------------------------------------------------------
-- Internal cost, in its own table
--
-- Cost and margin must never reach a customer. The obvious implementation is a
-- `cost_minor_units` column on quote_charge_line that the service leaves out of
-- the customer DTO - and that is exactly the implementation to avoid. PostgreSQL
-- row-level security is ROW level: it cannot hide a column. A cost column on a
-- customer-readable row is one forgotten `select: {}` away from being published,
-- and the mistake would be invisible in review.
--
-- Splitting it into a table the customer's policy denies outright makes the
-- guarantee structural. A customer session asking for cost gets nothing, whatever
-- the service layer does or forgets to do. This is foundation rule 1 - tenancy in
-- the data layer, not in code - applied to internal data.
--
-- Margin is NOT stored. It is sell minus cost, and a stored copy of a subtraction
-- is a second source of truth waiting to disagree.
-- ---------------------------------------------------------------------------
CREATE TABLE quote_charge_line_cost (
  quote_charge_line_id uuid PRIMARY KEY
    REFERENCES quote_charge_line (id) ON DELETE CASCADE,
  cost_minor_units     bigint NOT NULL,
  currency             char(3) NOT NULL,
  -- Who recorded it, for the same reason every other internal figure is attributed.
  recorded_by_id       uuid REFERENCES "user" (id) ON DELETE SET NULL,
  created_at           timestamptz(6) NOT NULL DEFAULT now(),
  updated_at           timestamptz(6) NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Options and charge lines inherit the quote's tenancy through an EXISTS, rather
-- than carrying their own customer_group_id. A denormalised copy is a copy that
-- can be wrong, and a charge line whose group disagreed with its quote's would be
-- visible to the wrong customer.
-- ---------------------------------------------------------------------------

ALTER TABLE quote_option ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_option FORCE ROW LEVEL SECURITY;

CREATE POLICY quote_option_tenant_isolation ON quote_option
  USING (
    EXISTS (
      SELECT 1 FROM quote q
      WHERE q.id = quote_option.quote_id
        AND (q.customer_group_id = app.current_group() OR app.is_internal())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quote q
      WHERE q.id = quote_option.quote_id
        AND (q.customer_group_id = app.current_group() OR app.is_internal())
    )
  );

ALTER TABLE quote_charge_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_charge_line FORCE ROW LEVEL SECURITY;

CREATE POLICY quote_charge_line_tenant_isolation ON quote_charge_line
  USING (
    EXISTS (
      SELECT 1 FROM quote_option o
      JOIN quote q ON q.id = o.quote_id
      WHERE o.id = quote_charge_line.quote_option_id
        AND (q.customer_group_id = app.current_group() OR app.is_internal())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quote_option o
      JOIN quote q ON q.id = o.quote_id
      WHERE o.id = quote_charge_line.quote_option_id
        AND (q.customer_group_id = app.current_group() OR app.is_internal())
    )
  );

ALTER TABLE quote_charge_line_cost ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_charge_line_cost FORCE ROW LEVEL SECURITY;

-- No customer branch. Not "internal OR the owning group" - internal, full stop.
CREATE POLICY quote_charge_line_cost_internal_only ON quote_charge_line_cost
  USING (app.is_internal())
  WITH CHECK (app.is_internal());

GRANT SELECT, INSERT, UPDATE, DELETE ON quote_option TO portal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON quote_charge_line TO portal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON quote_charge_line_cost TO portal_app;

COMMENT ON TABLE quote_charge_line_cost IS
  'Internal cost per charge line. Separate table, not a column, because RLS cannot hide a column. Never readable by a customer session under any service bug.';
COMMENT ON COLUMN quote_charge_line.amount_minor_units IS
  'quantity x rate, computed by the API. The browser never owns a figure that also appears on a PDF.';
