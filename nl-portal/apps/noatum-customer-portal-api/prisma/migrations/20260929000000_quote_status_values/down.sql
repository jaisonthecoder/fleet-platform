-- Reverses 20260929000000_quote_status_values.
--
-- PostgreSQL cannot drop a value from an enum, so the type is rebuilt without
-- the four new values. Any quote sitting in one of them would block the cast, so
-- those rows are moved back to `draft` first - deliberately loud in the notice,
-- because silently rewriting a customer's quote state is not something a down
-- migration should do without saying so.

DO $$
DECLARE
  affected bigint;
BEGIN
  UPDATE quote
  SET status = 'draft'
  WHERE status IN ('submitted', 'quoted', 'pending_sync', 'withdrawn');

  GET DIAGNOSTICS affected = ROW_COUNT;

  IF affected > 0 THEN
    RAISE NOTICE 'Reverted % quote row(s) to draft to drop the new enum values.', affected;
  END IF;
END
$$;

ALTER TYPE quote_status RENAME TO quote_status_old;

CREATE TYPE quote_status AS ENUM (
  'draft',
  'rated',
  'rate_failed',
  'expired',
  'accepted',
  'rejected'
);

ALTER TABLE quote
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE quote_status USING status::text::quote_status,
  ALTER COLUMN status SET DEFAULT 'draft';

DROP TYPE quote_status_old;
