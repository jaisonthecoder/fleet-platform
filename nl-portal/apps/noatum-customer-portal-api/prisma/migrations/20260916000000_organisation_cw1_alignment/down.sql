-- Reverses 20260916000000_organisation_cw1_alignment.

ALTER TABLE "org_registration_id" DROP COLUMN IF EXISTS "is_country_default";
ALTER TABLE "org_registration_id" DROP COLUMN IF EXISTS "scheme_description";
ALTER TABLE "org_registration_id" ALTER COLUMN "value" TYPE VARCHAR(120);

ALTER TABLE "org_address"
  DROP COLUMN IF EXISTS "phone",
  DROP COLUMN IF EXISTS "email",
  DROP COLUMN IF EXISTS "company_name_override",
  DROP COLUMN IF EXISTS "related_port_code";

DROP INDEX IF EXISTS "master_org_category_idx";
ALTER TABLE "master_org" RENAME COLUMN "source_controlling_customer_code" TO "source_parent_code";
ALTER TABLE "master_org" DROP COLUMN IF EXISTS "source_roles";
ALTER TABLE "master_org" DROP COLUMN IF EXISTS "category";

COMMENT ON TABLE "master_org" IS NULL;
COMMENT ON COLUMN "master_org"."is_customer" IS NULL;
COMMENT ON COLUMN "master_org"."is_supplier" IS NULL;
COMMENT ON COLUMN "master_org"."source_parent_code" IS NULL;
COMMENT ON COLUMN "master_org"."source_branch_code" IS NULL;
