-- Reverses 20260918000000_remove_link_approval.
--
-- Restores the columns, defaulting existing links to 'confirmed': they were
-- effective before this rollback and must stay effective after it.

CREATE TYPE "org_link_status" AS ENUM ('pending', 'confirmed');

ALTER TABLE "customer_account"
  ADD COLUMN "link_status"         "org_link_status" NOT NULL DEFAULT 'confirmed',
  ADD COLUMN "approved_by_user_id" UUID,
  ADD COLUMN "approved_at"         TIMESTAMPTZ(6);

ALTER TABLE "customer_account" ALTER COLUMN "link_status" SET DEFAULT 'pending';

ALTER TABLE "customer_account" ADD CONSTRAINT "customer_account_approved_by_user_id_fkey"
  FOREIGN KEY ("approved_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "customer_account_link_status_idx" ON "customer_account"("link_status");

COMMENT ON COLUMN "customer_account"."justification" IS NULL;
