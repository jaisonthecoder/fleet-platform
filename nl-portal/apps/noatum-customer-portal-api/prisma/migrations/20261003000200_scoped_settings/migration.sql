-- ---------------------------------------------------------------------------
-- ADR-010 - scoped settings
--
-- Feature switches answer "may anyone at Noatum use this at all", and that is
-- all they can answer: one key, one boolean, everywhere. The Platform ·
-- Quotation settings screen needs something a switch cannot express - the same
-- key resolving to a different answer per region, per branch, per customer.
-- The worked example from the mockup's own change log:
--
--   Publication mode · Branch ESVLC · CW1 confirmation -> Direct to customer
--   "CW1 quote write-back not yet live for ESVLC pilot"
--
-- One branch publishes directly while its region waits. A global boolean has to
-- be wrong for one of them.
--
-- This table holds ONLY the values an administrator has set. The catalogue -
-- which keys exist, their types and their defaults - is code, in
-- contracts/settings.ts. A row whose key is not in the catalogue is ignored, so
-- a stale key cannot resurrect a behaviour, exactly as with feature switches.
-- ---------------------------------------------------------------------------

CREATE TYPE setting_scope AS ENUM ('global', 'region', 'branch', 'customer');

CREATE TABLE setting_value (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           varchar(80) NOT NULL,
  scope         setting_scope NOT NULL,
  -- Region code, branch code, or a customer_group_id rendered as text. Held as
  -- text rather than four nullable typed columns because the resolver treats
  -- every layer identically, and three of the four would be null on every row.
  scope_id      varchar(64),
  -- jsonb, not text, because the catalogue has booleans, numbers and enums. The
  -- shape is validated in code against the catalogue on write.
  value         jsonb NOT NULL,
  -- NOT NULL. Every override carries its justification, because the mockup's
  -- settings log is the feature and a blank reason makes it worthless six
  -- months later when somebody asks why this branch is different.
  reason        varchar(400) NOT NULL,
  updated_by_id uuid REFERENCES "user" (id) ON DELETE SET NULL,
  created_at    timestamptz(6) NOT NULL DEFAULT now(),
  updated_at    timestamptz(6) NOT NULL DEFAULT now()
);

-- Global is the only scope with nothing to point at, and it must have nothing
-- to point at. Without this a row could claim to be global and still carry a
-- branch code, and the resolver would return it to every branch.
ALTER TABLE setting_value
  ADD CONSTRAINT setting_value_scope_id_matches_scope
    CHECK ((scope = 'global') = (scope_id IS NULL));

-- Two partial indexes rather than one, because a plain UNIQUE (key, scope,
-- scope_id) does NOT dedupe the global rows: NULL is not equal to NULL in a
-- unique index, so every global row would be accepted and the resolver would
-- pick one at random.
CREATE UNIQUE INDEX setting_value_global_unique
  ON setting_value (key)
  WHERE scope = 'global';

CREATE UNIQUE INDEX setting_value_scoped_unique
  ON setting_value (key, scope, scope_id)
  WHERE scope <> 'global';

-- The resolver reads every layer for a key in one query.
CREATE INDEX setting_value_key_idx ON setting_value (key);

ALTER TABLE setting_value ENABLE ROW LEVEL SECURITY;
ALTER TABLE setting_value FORCE ROW LEVEL SECURITY;

-- Reading: staff see everything. A customer session has to resolve settings too
-- - `disclose` decides whether their own quote names the carrier - so it may
-- read the layers that can apply to it: the non-customer layers, and its own
-- customer row. It may never read another customer's row, which would reveal
-- that the group exists.
CREATE POLICY setting_value_read ON setting_value
  FOR SELECT
  USING (
    app.is_internal()
    OR scope <> 'customer'
    OR scope_id = app.current_group()::text
  );

-- Writing is internal only, at every scope including the customer one. A
-- customer never configures the platform for themselves.
CREATE POLICY setting_value_write ON setting_value
  FOR ALL
  USING (app.is_internal())
  WITH CHECK (app.is_internal());

GRANT SELECT, INSERT, UPDATE, DELETE ON setting_value TO portal_app;

COMMENT ON TABLE setting_value IS
  'ADR-010. Overrides only; the catalogue and defaults are code. Resolution order is global < region < branch < customer, most specific wins.';
COMMENT ON COLUMN setting_value.reason IS
  'Mandatory. Surfaced in the settings change log next to the before and after values.';
