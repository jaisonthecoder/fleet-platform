-- Reverses 20260917000000_customer_identity_and_link_servicing.

ALTER TABLE "customer_account" DROP CONSTRAINT IF EXISTS "customer_account_servicing_branch_id_fkey";
DROP INDEX IF EXISTS "customer_account_servicing_branch_id_idx";
ALTER TABLE "customer_account" DROP COLUMN IF EXISTS "servicing_branch_id";
COMMENT ON TABLE "customer_account" IS NULL;

ALTER TABLE "customer_group" DROP CONSTRAINT IF EXISTS "customer_group_default_servicing_branch_id_fkey";
ALTER TABLE "customer_group" DROP CONSTRAINT IF EXISTS "customer_group_parent_not_self";
ALTER TABLE "customer_group" DROP CONSTRAINT IF EXISTS "customer_group_parent_id_fkey";
DROP INDEX IF EXISTS "customer_group_parent_id_idx";
DROP INDEX IF EXISTS "customer_group_status_idx";

ALTER TABLE "customer_group"
  DROP COLUMN IF EXISTS "default_servicing_branch_id",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "email_domains",
  DROP COLUMN IF EXISTS "country_code",
  DROP COLUMN IF EXISTS "legal_name",
  DROP COLUMN IF EXISTS "parent_id";

DROP TYPE IF EXISTS "customer_status";
