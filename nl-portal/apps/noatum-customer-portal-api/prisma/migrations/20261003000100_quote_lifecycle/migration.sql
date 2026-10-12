-- ---------------------------------------------------------------------------
-- C3 (2 of 2) - the quote lifecycle moves onto the new values, and gains the
-- columns that record who did what.
--
-- Safe to run only after 20261003000000 has committed, because an enum value
-- cannot be used in the transaction that created it.
-- ---------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- 1. The data move
--
-- `quoted` -> `published`, NOT `priced`. This is the one row in this migration
-- that can do real harm if it is got wrong. `quoted` already meant "the
-- customer can see an answer". Mapping it to `priced` - which is deliberately
-- invisible to the customer - would retract, in a single UPDATE, every price a
-- customer was already looking at. They would see quotes silently revert to
-- "in progress" with no explanation and no way back.
--
-- `pending_sync` -> `priced`. It meant "answered, waiting for CargoWise", and
-- that is now `priced` under `pubMode = cw1`. Correctly NOT `published`: these
-- are exactly the quotes the customer could not yet see.
-- --------------------------------------------------------------------------
UPDATE quote SET status = 'requested' WHERE status = 'submitted';
UPDATE quote SET status = 'published' WHERE status = 'quoted';
UPDATE quote SET status = 'priced'    WHERE status = 'pending_sync';

ALTER TABLE quote ALTER COLUMN status SET DEFAULT 'draft';

-- --------------------------------------------------------------------------
-- 2. Who is working on it
--
-- Nullable, and released on publish, withdraw or expiry. There is deliberately
-- no foreign key onto `app_user` with ON DELETE RESTRICT: a leaver must be
-- removable without first hunting down every quote they ever touched. SET NULL
-- loses the name, which is what the audit record is for.
-- --------------------------------------------------------------------------
ALTER TABLE quote
  ADD COLUMN IF NOT EXISTS claimed_by_id   uuid,
  ADD COLUMN IF NOT EXISTS claimed_at      timestamptz(6),
  ADD COLUMN IF NOT EXISTS priced_by_id    uuid,
  ADD COLUMN IF NOT EXISTS priced_at       timestamptz(6),
  ADD COLUMN IF NOT EXISTS approved_by_id  uuid,
  ADD COLUMN IF NOT EXISTS approved_at     timestamptz(6),
  ADD COLUMN IF NOT EXISTS published_by_id uuid,
  ADD COLUMN IF NOT EXISTS published_at    timestamptz(6),
  -- The customer sees this number (the mockup shows "version 2"), so a re-price
  -- of a PUBLISHED quote supersedes visibly rather than editing in place.
  -- Incremented by C4; the column exists now so re-pricing is not also a
  -- schema change.
  ADD COLUMN IF NOT EXISTS version         integer NOT NULL DEFAULT 1;

-- `user` is a reserved word in SQL, hence the quoting throughout.
ALTER TABLE quote
  ADD CONSTRAINT quote_claimed_by_fk
    FOREIGN KEY (claimed_by_id) REFERENCES "user" (id) ON DELETE SET NULL,
  ADD CONSTRAINT quote_priced_by_fk
    FOREIGN KEY (priced_by_id) REFERENCES "user" (id) ON DELETE SET NULL,
  ADD CONSTRAINT quote_approved_by_fk
    FOREIGN KEY (approved_by_id) REFERENCES "user" (id) ON DELETE SET NULL,
  ADD CONSTRAINT quote_published_by_fk
    FOREIGN KEY (published_by_id) REFERENCES "user" (id) ON DELETE SET NULL;

-- A claim is held or it is not. Half a claim - a holder with no timestamp - is
-- unexpirable, which is the one state the 4-hour rule cannot recover from.
ALTER TABLE quote
  ADD CONSTRAINT quote_claim_is_whole
    CHECK ((claimed_by_id IS NULL) = (claimed_at IS NULL));

-- The pricing queue reads "unclaimed, oldest first" on every refresh, and the
-- claim expiry sweep reads "claimed before X". Partial, because a claimed quote
-- is a rounding error against the whole table.
CREATE INDEX IF NOT EXISTS quote_claimed_idx
  ON quote (claimed_at)
  WHERE claimed_by_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS quote_pricing_queue_idx
  ON quote (status, created_at)
  WHERE status IN ('requested', 'claimed', 'priced', 'approved');

COMMENT ON COLUMN quote.claimed_by_id IS
  'Internal holder of the pricing claim. NEVER projected into a customer DTO - the customer activity log names the branch, never the person.';
COMMENT ON COLUMN quote.version IS
  'Customer-visible. Incremented when an already-published quote is re-priced, so an acceptance can name the version it accepted.';
