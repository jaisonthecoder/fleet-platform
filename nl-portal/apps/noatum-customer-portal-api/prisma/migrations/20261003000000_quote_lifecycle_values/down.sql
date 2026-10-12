-- Reverses 20261003000000_quote_lifecycle_values.
--
-- PostgreSQL cannot drop a value from an enum, so the type is rebuilt without
-- the five new values. Any quote sitting in one of them would block the cast.
--
-- The rows are moved back to the value that carried the same MEANING before C3,
-- not to `draft`. `published` and `approved` both meant "the customer can see an
-- answer", which was `quoted`; `requested` and `claimed` were `submitted`. A
-- down migration that flattened a live, customer-visible quote to `draft` would
-- retract a price somebody had already been shown - which is a worse outcome
-- than the failed deployment it is trying to undo.
--
-- `priced` is the awkward one: before C3 there was no state for "answered but
-- not yet released", so it maps back to `submitted`. That is a real loss of
-- information, and it is the honest mapping, because the old vocabulary simply
-- could not express it.

DO $$
DECLARE
  affected bigint;
BEGIN
  UPDATE quote
  SET status = CASE
    WHEN status IN ('published', 'approved') THEN 'quoted'::quote_status
    ELSE 'submitted'::quote_status
  END
  WHERE status IN ('requested', 'claimed', 'priced', 'approved', 'published');

  GET DIAGNOSTICS affected = ROW_COUNT;

  IF affected > 0 THEN
    RAISE NOTICE 'Moved % quote row(s) off the C3 lifecycle values to drop them.', affected;
  END IF;
END
$$;

ALTER TYPE quote_status RENAME TO quote_status_old;

CREATE TYPE quote_status AS ENUM (
  'draft',
  'submitted',
  'quoted',
  'pending_sync',
  'rated',
  'rate_failed',
  'expired',
  'accepted',
  'rejected',
  'withdrawn'
);

ALTER TABLE quote
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE quote_status USING status::text::quote_status,
  ALTER COLUMN status SET DEFAULT 'draft';

DROP TYPE quote_status_old;
