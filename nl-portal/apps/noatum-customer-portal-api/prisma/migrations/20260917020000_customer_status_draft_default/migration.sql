-- A new customer now starts in `draft`: named, granting nothing, deletable.
-- Separate from 20260917010000 because PostgreSQL refuses to use a new enum
-- value in the transaction that added it.

ALTER TABLE "customer_group" ALTER COLUMN "status" SET DEFAULT 'draft';
