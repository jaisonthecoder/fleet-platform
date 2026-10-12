-- Reverses 20260915000000_organisation_directory.
--
-- master_org returns to its six-column stub shape, including the synced_at
-- column, so an environment rolled back here still matches the pre-ORG-02
-- Prisma schema. Directory rows that only exist in the new columns are lost by
-- definition; that is what reversing a schema expansion means.

ALTER TABLE "customer_account" DROP CONSTRAINT IF EXISTS "customer_account_org_confirmed_fkey";
ALTER TABLE "customer_account" DROP CONSTRAINT IF EXISTS "customer_account_linked_by_user_id_fkey";
ALTER TABLE "customer_account" DROP CONSTRAINT IF EXISTS "customer_account_approved_by_user_id_fkey";
DROP INDEX IF EXISTS "customer_account_org_id_idx";
DROP INDEX IF EXISTS "customer_account_link_status_idx";

ALTER TABLE "customer_account"
  DROP COLUMN IF EXISTS "org_confirmed",
  DROP COLUMN IF EXISTS "org_id",
  DROP COLUMN IF EXISTS "link_status",
  DROP COLUMN IF EXISTS "justification",
  DROP COLUMN IF EXISTS "linked_by_user_id",
  DROP COLUMN IF EXISTS "linked_at",
  DROP COLUMN IF EXISTS "approved_by_user_id",
  DROP COLUMN IF EXISTS "approved_at";

DROP TABLE IF EXISTS "org_change_log";
DROP TABLE IF EXISTS "org_contact";
DROP TABLE IF EXISTS "org_registration_id";
DROP TABLE IF EXISTS "org_address";

ALTER TABLE "master_org" DROP CONSTRAINT IF EXISTS "master_org_confirmed_by_run_id_fkey";

DROP TABLE IF EXISTS "org_import_run";

DROP INDEX IF EXISTS "master_org_source_identity_key";
DROP INDEX IF EXISTS "master_org_code_norm_idx";
DROP INDEX IF EXISTS "master_org_is_active_idx";
DROP INDEX IF EXISTS "master_org_country_code_idx";
ALTER TABLE "master_org" DROP CONSTRAINT IF EXISTS "master_org_id_is_source_confirmed_key";
ALTER TABLE "master_org" DROP CONSTRAINT IF EXISTS "master_org_source_code_trimmed";

ALTER TABLE "master_org" ADD COLUMN IF NOT EXISTS "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now();
UPDATE "master_org" SET "synced_at" = COALESCE("last_seen_at", "first_seen_at");

ALTER TABLE "master_org"
  DROP COLUMN IF EXISTS "code_norm",
  DROP COLUMN IF EXISTS "id",
  DROP COLUMN IF EXISTS "source_system",
  DROP COLUMN IF EXISTS "source_instance",
  DROP COLUMN IF EXISTS "source_kind",
  DROP COLUMN IF EXISTS "legal_name",
  DROP COLUMN IF EXISTS "state",
  DROP COLUMN IF EXISTS "postcode",
  DROP COLUMN IF EXISTS "source_branch_code",
  DROP COLUMN IF EXISTS "source_parent_code",
  DROP COLUMN IF EXISTS "is_supplier",
  DROP COLUMN IF EXISTS "is_active",
  DROP COLUMN IF EXISTS "is_source_confirmed",
  DROP COLUMN IF EXISTS "confirmed_by_run_id",
  DROP COLUMN IF EXISTS "source_version",
  DROP COLUMN IF EXISTS "source_hash",
  DROP COLUMN IF EXISTS "first_seen_at",
  DROP COLUMN IF EXISTS "last_seen_at",
  DROP COLUMN IF EXISTS "created_at",
  DROP COLUMN IF EXISTS "updated_at";

ALTER TABLE "master_org" RENAME COLUMN "source_code" TO "code";
ALTER TABLE "master_org" ADD CONSTRAINT "master_org_pkey" PRIMARY KEY ("code");

DROP TYPE IF EXISTS "org_import_outcome";
DROP TYPE IF EXISTS "org_import_mode";
DROP TYPE IF EXISTS "org_link_status";
DROP TYPE IF EXISTS "org_source_kind";
