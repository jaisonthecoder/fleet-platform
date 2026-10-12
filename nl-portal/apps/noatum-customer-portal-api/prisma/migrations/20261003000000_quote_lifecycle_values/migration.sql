-- ---------------------------------------------------------------------------
-- C3 (1 of 2) - quote_status gains the staff half of the lifecycle
--
-- Q0 gave the enum `submitted` and `quoted`: a customer asks, a person answers.
-- That was enough while nothing happened in between. The staff pricing screen
-- shows that a great deal happens in between, and it has names for all of it -
-- a five-stage stepper reading Requested, Claimed, Priced, Approved, Published.
--
-- Five values are added so the API can say the same words the screen says. The
-- data move onto them is the NEXT migration: PostgreSQL refuses to use an enum
-- value inside the transaction that added it, and Prisma wraps each migration
-- in one. Splitting them is not tidiness, it is the only thing that works.
--
-- Nothing is removed here, or anywhere. Enum value removal is not reversible in
-- place, and a `quote` row written last week still has to read. Old values stop
-- being WRITTEN; they do not stop EXISTING. What actually retires them is the
-- status machine refusing them as the source of any transition.
-- ---------------------------------------------------------------------------

-- `requested` supersedes `submitted`. Placed next to it so `ORDER BY status`
-- keeps the lifecycle roughly in lifecycle order, which is the only ordering
-- an enum gives you and it costs nothing to keep.
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'requested' AFTER 'draft';
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'claimed' AFTER 'requested';
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'priced' AFTER 'claimed';
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'approved' AFTER 'priced';
ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'published' AFTER 'approved';
