-- Reverses 20261003000100_quote_lifecycle.
--
-- The data move is undone first, while the old enum values still exist. The
-- mapping back is the inverse of the one going out, and it is lossy in exactly
-- one place: `claimed` had no pre-C3 equivalent, so it returns to `submitted`
-- and the fact that somebody had picked it up survives only in the audit trail.

UPDATE quote SET status = 'submitted'    WHERE status IN ('requested', 'claimed');
UPDATE quote SET status = 'quoted'       WHERE status IN ('published', 'approved');
UPDATE quote SET status = 'pending_sync' WHERE status = 'priced';

DROP INDEX IF EXISTS quote_pricing_queue_idx;
DROP INDEX IF EXISTS quote_claimed_idx;

ALTER TABLE quote
  DROP CONSTRAINT IF EXISTS quote_claim_is_whole,
  DROP CONSTRAINT IF EXISTS quote_claimed_by_fk,
  DROP CONSTRAINT IF EXISTS quote_priced_by_fk,
  DROP CONSTRAINT IF EXISTS quote_approved_by_fk,
  DROP CONSTRAINT IF EXISTS quote_published_by_fk;

ALTER TABLE quote
  DROP COLUMN IF EXISTS claimed_by_id,
  DROP COLUMN IF EXISTS claimed_at,
  DROP COLUMN IF EXISTS priced_by_id,
  DROP COLUMN IF EXISTS priced_at,
  DROP COLUMN IF EXISTS approved_by_id,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS published_by_id,
  DROP COLUMN IF EXISTS published_at,
  DROP COLUMN IF EXISTS version;
