-- Rollback for 0057_person_credentials.
ALTER TABLE "fleet"."person"
  DROP CONSTRAINT IF EXISTS "person_licence_updated_by_fk";
--> statement-breakpoint
ALTER TABLE "fleet"."person"
  DROP CONSTRAINT IF EXISTS "person_emirates_id_updated_by_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "fleet"."person_emirates_id_expiry_idx";
--> statement-breakpoint
ALTER TABLE "fleet"."person"
  DROP COLUMN IF EXISTS "licence_source",
  DROP COLUMN IF EXISTS "licence_verified",
  DROP COLUMN IF EXISTS "licence_updated_by",
  DROP COLUMN IF EXISTS "emirates_id",
  DROP COLUMN IF EXISTS "emirates_id_expiry",
  DROP COLUMN IF EXISTS "emirates_id_source",
  DROP COLUMN IF EXISTS "emirates_id_verified",
  DROP COLUMN IF EXISTS "emirates_id_updated_by",
  DROP COLUMN IF EXISTS "last_hcm_synced_at";
