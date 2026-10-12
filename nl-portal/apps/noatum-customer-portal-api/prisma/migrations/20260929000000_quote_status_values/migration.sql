-- ---------------------------------------------------------------------------
-- Q0 (1 of 2) - quote_status gains the states a human-answered quote needs
--
-- The enum was written for a rate engine: `rated` and `rate_failed` are machine
-- words, and there was no state for "the customer has asked" or "a person has
-- answered". Four values are added here.
--
-- This migration adds the values and NOTHING ELSE. PostgreSQL refuses to use an
-- enum value inside the transaction that added it, and Prisma wraps each
-- migration in one, so anything that references these lives in the next
-- migration. Splitting them is not tidiness, it is the only thing that works.
--
-- `rated` and `rate_failed` are deliberately NOT removed. Enum value removal is
-- not reversible in place, and the instant-rate path keeps its seam behind the
-- quotations.instant_rate switch. They are deprecated in code comments only.
-- ---------------------------------------------------------------------------

ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'submitted' AFTER 'draft';
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'quoted' AFTER 'submitted';
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'pending_sync' AFTER 'quoted';
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'withdrawn';
