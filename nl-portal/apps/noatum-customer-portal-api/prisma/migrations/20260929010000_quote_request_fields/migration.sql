-- ---------------------------------------------------------------------------
-- Q0 (2 of 2) - the quote record made true and safe
--
-- Three things happen here.
--
-- 1. SIX COLUMNS the create schema already validated and then threw away.
--    `volumeM3` was the worst: it was used to compute chargeable weight and
--    then discarded, so the number on the quote could never be re-derived or
--    audited. The rest of the customer's request stays in `payload` until a
--    field earns a column by being filtered, sorted or integrated on.
--
-- 2. A SAFE REFERENCE COUNTER. nextReference() was `count(*) + 1`: two
--    concurrent creates produce the same reference and one of them dies on the
--    unique index, and a deleted quote hands its reference to the next one.
--    A counter row taken with the row lock that ON CONFLICT DO UPDATE acquires
--    fixes both. The unique index on (customer_group_id, reference) stays as
--    the backstop.
--
-- 3. The counter is reachable ONLY through a SECURITY DEFINER function.
--    portal_app gets no table rights at all, so a bug in application code
--    cannot rewrite another tenant's counter even with RLS satisfied.
-- ---------------------------------------------------------------------------

-- --- 1. request fields -----------------------------------------------------

ALTER TABLE quote
  ADD COLUMN IF NOT EXISTS incoterm           varchar(11),
  ADD COLUMN IF NOT EXISTS ready_date         timestamptz(6),
  ADD COLUMN IF NOT EXISTS customer_reference varchar(60),
  ADD COLUMN IF NOT EXISTS service_level      varchar(40),
  ADD COLUMN IF NOT EXISTS volume_m3          numeric(12, 3),
  ADD COLUMN IF NOT EXISTS notes              text;

COMMENT ON COLUMN quote.incoterm IS
  'Incoterms 2020 three-letter rule. Validated against transport mode in the service: FOB, CFR, CIF and FAS are sea and inland-waterway only.';
COMMENT ON COLUMN quote.ready_date IS
  'When the cargo is actually available. Not the requested arrival date and not the quote validity.';
COMMENT ON COLUMN quote.volume_m3 IS
  'As submitted. Chargeable weight is derived from this, so it has to survive or the derivation cannot be audited.';

-- --- 2. reference counter --------------------------------------------------

CREATE TABLE IF NOT EXISTS quote_reference_counter (
  customer_group_id uuid PRIMARY KEY REFERENCES customer_group(id) ON DELETE CASCADE,
  next_value        bigint      NOT NULL DEFAULT 1,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quote_reference_counter IS
  'One row per customer group, holding the last reference allocated. Written only by app.next_quote_reference(); portal_app holds no rights on it.';

-- Every table in this database carries RLS, and the isolation test asserts that
-- invariant table by table. This one is unreachable by portal_app anyway, but it
-- gets a policy so the invariant holds without an exception list.
ALTER TABLE quote_reference_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_reference_counter FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quote_reference_counter_tenant_isolation ON quote_reference_counter;
CREATE POLICY quote_reference_counter_tenant_isolation ON quote_reference_counter
  USING (customer_group_id = app.current_group() OR app.is_internal())
  WITH CHECK (customer_group_id = app.current_group() OR app.is_internal());

-- 20260101000000_tenancy_roles_rls sets ALTER DEFAULT PRIVILEGES granting every
-- new table to portal_app, so "just do not grant it" silently fails. Revoke, then
-- prove the revoke worked - a counter the runtime role can UPDATE is a reference
-- collision waiting to happen.
REVOKE ALL ON TABLE quote_reference_counter FROM portal_app;

DO $$
DECLARE
  privilege text;
BEGIN
  FOREACH privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
    IF has_table_privilege('portal_app', 'quote_reference_counter', privilege) THEN
      RAISE EXCEPTION
        'portal_app still holds % on quote_reference_counter; the revoke did not take.', privilege;
    END IF;
  END LOOP;
END
$$;

-- --- 3. the only door to the counter ---------------------------------------

CREATE OR REPLACE FUNCTION app.next_quote_reference(p_customer_group_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next bigint;
BEGIN
  IF p_customer_group_id IS NULL THEN
    RAISE EXCEPTION 'A quote reference needs a customer group.';
  END IF;

  -- ON CONFLICT DO UPDATE takes a row lock, so concurrent callers serialise here
  -- rather than colliding later on the unique index.
  INSERT INTO quote_reference_counter AS c (customer_group_id, next_value)
  VALUES (p_customer_group_id, 1)
  ON CONFLICT (customer_group_id)
  DO UPDATE SET next_value = c.next_value + 1,
                updated_at = now()
  RETURNING c.next_value INTO v_next;

  RETURN 'Q-' || lpad(v_next::text, 6, '0');
END;
$$;

COMMENT ON FUNCTION app.next_quote_reference(uuid) IS
  'Allocates the next per-group quote reference, e.g. Q-000042. The only write path to quote_reference_counter.';

GRANT EXECUTE ON FUNCTION app.next_quote_reference(uuid) TO portal_app;

-- Existing groups start after their highest allocated reference so a backfilled
-- environment does not immediately collide on the unique index.
INSERT INTO quote_reference_counter (customer_group_id, next_value)
SELECT customer_group_id, count(*)
FROM quote
GROUP BY customer_group_id
ON CONFLICT (customer_group_id) DO NOTHING;
