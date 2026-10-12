-- Reverses 20260917010000_customer_status_draft.
--
-- PostgreSQL cannot drop a value from an enum, so the type is rebuilt. Any row
-- still sitting in 'draft' is moved to 'onboarding' first - reversing a
-- lifecycle state cannot preserve a state that no longer exists.

ALTER TABLE "customer_group" ALTER COLUMN "status" DROP DEFAULT;
UPDATE "customer_group" SET "status" = 'onboarding' WHERE "status" = 'draft';

ALTER TYPE "customer_status" RENAME TO "customer_status_old";
CREATE TYPE "customer_status" AS ENUM ('onboarding', 'active', 'suspended', 'closed');

ALTER TABLE "customer_group"
  ALTER COLUMN "status" TYPE "customer_status"
  USING ("status"::text::"customer_status");

ALTER TABLE "customer_group" ALTER COLUMN "status" SET DEFAULT 'onboarding';
DROP TYPE "customer_status_old";
