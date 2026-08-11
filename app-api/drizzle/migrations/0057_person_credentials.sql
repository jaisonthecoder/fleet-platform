-- 0057 — Person driver credentials: Emirates ID + provenance/verification for
-- licence & Emirates ID, plus a dedicated HCM last-sync marker (distinct from
-- the row's updated_at_utc). Additive + backfilled; no existing behaviour changes.
ALTER TABLE "fleet"."person"
  ADD COLUMN IF NOT EXISTS "licence_source" text,
  ADD COLUMN IF NOT EXISTS "licence_verified" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "licence_updated_by" uuid,
  ADD COLUMN IF NOT EXISTS "emirates_id" text,
  ADD COLUMN IF NOT EXISTS "emirates_id_expiry" date,
  ADD COLUMN IF NOT EXISTS "emirates_id_source" text,
  ADD COLUMN IF NOT EXISTS "emirates_id_verified" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "emirates_id_updated_by" uuid,
  ADD COLUMN IF NOT EXISTS "last_hcm_synced_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "fleet"."person"
  ADD CONSTRAINT "person_licence_updated_by_fk"
    FOREIGN KEY ("licence_updated_by") REFERENCES "fleet"."person"("id");
--> statement-breakpoint
ALTER TABLE "fleet"."person"
  ADD CONSTRAINT "person_emirates_id_updated_by_fk"
    FOREIGN KEY ("emirates_id_updated_by") REFERENCES "fleet"."person"("id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_emirates_id_expiry_idx"
  ON "fleet"."person" ("emirates_id_expiry");
--> statement-breakpoint
-- Backfill: existing licence values originate from seed/import; mark provenance
-- and seed the HCM last-sync marker from the row timestamp so the freshness gate
-- (when HCM is enabled) has a starting point.
UPDATE "fleet"."person"
  SET "licence_source" = 'seed'
  WHERE "licence_number" IS NOT NULL AND "licence_source" IS NULL;
--> statement-breakpoint
UPDATE "fleet"."person"
  SET "last_hcm_synced_at" = "updated_at_utc"
  WHERE "last_hcm_synced_at" IS NULL;
