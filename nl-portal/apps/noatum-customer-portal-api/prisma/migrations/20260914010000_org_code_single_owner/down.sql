-- Reverses 20260914010000_org_code_single_owner.
--
-- Dropping this index removes the guarantee that one organisation code belongs
-- to one customer. Do not run it to work around a duplicate: a duplicate is the
-- problem, not the constraint.

DROP INDEX IF EXISTS "customer_account_cw1_org_code_norm_key";
ALTER TABLE "customer_account" DROP CONSTRAINT IF EXISTS "customer_account_cw1_org_code_trimmed";
