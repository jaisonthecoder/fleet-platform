ALTER TYPE "public"."fleet_key_custody" ADD VALUE IF NOT EXISTS 'Lost';
--> statement-breakpoint
ALTER TYPE "public"."fleet_key_custody" ADD VALUE IF NOT EXISTS 'Recovered';
--> statement-breakpoint
ALTER TYPE "public"."fleet_key_custody" ADD VALUE IF NOT EXISTS 'Replaced';
--> statement-breakpoint
ALTER TABLE "fleet"."handover"
  ADD COLUMN IF NOT EXISTS "revision" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "checklist_definition_version" integer,
  ADD COLUMN IF NOT EXISTS "release_location_node_id" uuid,
  ADD COLUMN IF NOT EXISTS "release_location_code" text,
  ADD COLUMN IF NOT EXISTS "release_location_name" text,
  ADD COLUMN IF NOT EXISTS "return_location_node_id" uuid,
  ADD COLUMN IF NOT EXISTS "return_location_code" text,
  ADD COLUMN IF NOT EXISTS "return_location_name" text,
  ADD COLUMN IF NOT EXISTS "return_condition_code" text,
  ADD COLUMN IF NOT EXISTS "key_outcome" text,
  ADD COLUMN IF NOT EXISTS "key_review_ref" text,
  ADD COLUMN IF NOT EXISTS "telematics_status" text,
  ADD COLUMN IF NOT EXISTS "telematics_observed_at_utc" timestamptz,
  ADD COLUMN IF NOT EXISTS "reconciliation_status" text,
  ADD COLUMN IF NOT EXISTS "reconciliation_provenance" jsonb,
  ADD COLUMN IF NOT EXISTS "evidence_completeness" text NOT NULL DEFAULT 'LegacyPartial';
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fleet"."handover" ADD CONSTRAINT "handover_release_location_fk"
    FOREIGN KEY ("release_location_node_id") REFERENCES "fleet"."hierarchy_node"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fleet"."handover" ADD CONSTRAINT "handover_return_location_fk"
    FOREIGN KEY ("return_location_node_id") REFERENCES "fleet"."hierarchy_node"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fleet"."handover" ADD CONSTRAINT "handover_revision_positive"
    CHECK ("revision" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fleet"."handover" ADD CONSTRAINT "handover_return_condition_code_valid"
    CHECK ("return_condition_code" IS NULL OR "return_condition_code" IN ('Good', 'MinorWear', 'DamageNoted'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fleet"."handover" ADD CONSTRAINT "handover_key_outcome_valid"
    CHECK ("key_outcome" IS NULL OR "key_outcome" IN ('Returned', 'LostReviewRequired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fleet"."handover" ADD CONSTRAINT "handover_telematics_status_valid"
    CHECK ("telematics_status" IS NULL OR "telematics_status" IN ('MATCHED', 'STALE', 'UNAVAILABLE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fleet"."handover" ADD CONSTRAINT "handover_reconciliation_status_valid"
    CHECK ("reconciliation_status" IS NULL OR "reconciliation_status" IN ('MATCHED', 'ADVISORY', 'CONFLICT', 'UNAVAILABLE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fleet"."handover" ADD CONSTRAINT "handover_evidence_completeness_valid"
    CHECK ("evidence_completeness" IN ('Complete', 'LegacyPartial'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "handover_org_activity_idx"
  ON "fleet"."handover" ("organization_id", COALESCE("return_at_utc", "handover_at_utc") DESC, "id" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fleet"."handover_inspection_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001',
  "handover_id" uuid NOT NULL REFERENCES "fleet"."handover"("id"),
  "capture_phase" text NOT NULL,
  "definition_version" integer NOT NULL,
  "item_code" text NOT NULL,
  "verdict" text NOT NULL,
  "note" text,
  "evidence_refs" text[] NOT NULL DEFAULT '{}',
  "captured_by_person_id" uuid REFERENCES "fleet"."person"("id"),
  "captured_at_utc" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "handover_inspection_phase_valid" CHECK ("capture_phase" IN ('Handover', 'Return')),
  CONSTRAINT "handover_inspection_item_code_valid" CHECK ("item_code" IN ('body', 'tyres', 'lights', 'assets', 'cabin')),
  CONSTRAINT "handover_inspection_verdict_valid" CHECK ("verdict" IN ('Pass', 'Fail')),
  CONSTRAINT "handover_inspection_definition_positive" CHECK ("definition_version" > 0),
  CONSTRAINT "handover_inspection_fail_evidence" CHECK ("verdict" = 'Pass' OR (NULLIF(btrim("note"), '') IS NOT NULL AND cardinality("evidence_refs") > 0)),
  CONSTRAINT "handover_inspection_item_uq" UNIQUE ("handover_id", "capture_phase", "item_code")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "handover_inspection_handover_idx"
  ON "fleet"."handover_inspection_item" ("handover_id", "capture_phase", "item_code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fleet"."handover_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001',
  "uploaded_by_person_id" uuid NOT NULL REFERENCES "fleet"."person"("id"),
  "handover_id" uuid REFERENCES "fleet"."handover"("id"),
  "evidence_type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'Staged',
  "object_key" text NOT NULL,
  "content_sha256" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "signer_person_id" uuid REFERENCES "fleet"."person"("id"),
  "captured_by_person_id" uuid REFERENCES "fleet"."person"("id"),
  "device_ref" text,
  "staged_at_utc" timestamptz NOT NULL DEFAULT now(),
  "claimed_at_utc" timestamptz,
  "expires_at_utc" timestamptz NOT NULL,
  "created_at_utc" timestamptz NOT NULL DEFAULT now(),
  "updated_at_utc" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "handover_evidence_type_valid" CHECK ("evidence_type" IN ('VehiclePhoto', 'DamagePhoto', 'Signature', 'LegacyReference')),
  CONSTRAINT "handover_evidence_status_valid" CHECK ("status" IN ('Staged', 'Claimed', 'Expired')),
  CONSTRAINT "handover_evidence_hash_valid" CHECK ("content_sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "handover_evidence_mime_valid" CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'application/x-legacy-reference')),
  CONSTRAINT "handover_evidence_size_valid" CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760),
  CONSTRAINT "handover_evidence_expiry_valid" CHECK ("expires_at_utc" > "staged_at_utc"),
  CONSTRAINT "handover_evidence_object_key_valid" CHECK (
    ("evidence_type" = 'LegacyReference' AND "object_key" LIKE 'legacy:%') OR
    ("evidence_type" <> 'LegacyReference' AND "object_key" ~ '^handover-evidence/[A-Za-z0-9][A-Za-z0-9._/-]*$' AND "object_key" NOT LIKE '%..%' AND "object_key" NOT LIKE '%//%')
  ),
  CONSTRAINT "handover_evidence_claim_valid" CHECK (
    ("status" = 'Staged' AND "handover_id" IS NULL AND "claimed_at_utc" IS NULL) OR
    ("status" = 'Claimed' AND "handover_id" IS NOT NULL AND "claimed_at_utc" IS NOT NULL) OR
    "status" = 'Expired'
  ),
  CONSTRAINT "handover_evidence_object_key_uq" UNIQUE ("object_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "handover_evidence_staged_expiry_idx"
  ON "fleet"."handover_evidence" ("organization_id", "status", "expires_at_utc");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "handover_evidence_handover_idx"
  ON "fleet"."handover_evidence" ("handover_id", "evidence_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fleet"."handover_amendment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001',
  "handover_id" uuid NOT NULL REFERENCES "fleet"."handover"("id"),
  "revision" integer NOT NULL,
  "reason" text NOT NULL,
  "actor_person_id" uuid NOT NULL REFERENCES "fleet"."person"("id"),
  "evidence_refs" text[] NOT NULL DEFAULT '{}',
  "effective_patch" jsonb NOT NULL DEFAULT '{}',
  "created_at_utc" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "handover_amendment_revision_positive" CHECK ("revision" > 0),
  CONSTRAINT "handover_amendment_reason_required" CHECK (NULLIF(btrim("reason"), '') IS NOT NULL),
  CONSTRAINT "handover_amendment_revision_uq" UNIQUE ("handover_id", "revision")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "handover_amendment_handover_idx"
  ON "fleet"."handover_amendment" ("handover_id", "revision");
--> statement-breakpoint
ALTER TABLE "fleet"."damage_pin"
  ADD COLUMN IF NOT EXISTS "carried_from_damage_pin_id" uuid,
  ADD COLUMN IF NOT EXISTS "lifecycle_status" text NOT NULL DEFAULT 'Open';
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fleet"."damage_pin" ADD CONSTRAINT "damage_pin_carried_from_fk"
    FOREIGN KEY ("carried_from_damage_pin_id") REFERENCES "fleet"."damage_pin"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fleet"."damage_pin" ADD CONSTRAINT "damage_pin_lifecycle_status_valid"
    CHECK ("lifecycle_status" IN ('Open', 'Repaired', 'Closed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "fleet"."key_log"
  ADD COLUMN IF NOT EXISTS "incident_reason" text,
  ADD COLUMN IF NOT EXISTS "review_ref" text;
--> statement-breakpoint
INSERT INTO "fleet"."handover_inspection_item" (
  "organization_id", "handover_id", "capture_phase", "definition_version", "item_code", "verdict", "captured_at_utc"
)
SELECT
  h."organization_id",
  h."id",
  'Handover',
  1,
  CASE
    WHEN lower(item->>'item') LIKE '%bod%' OR lower(item->>'item') LIKE '%glass%' THEN 'body'
    WHEN lower(item->>'item') LIKE '%tyre%' OR lower(item->>'item') LIKE '%spare%' THEN 'tyres'
    WHEN lower(item->>'item') LIKE '%light%' OR lower(item->>'item') LIKE '%indicator%' THEN 'lights'
    WHEN lower(item->>'item') LIKE '%asset%' OR lower(item->>'item') LIKE '%salik%' THEN 'assets'
    WHEN lower(item->>'item') LIKE '%cabin%' THEN 'cabin'
    ELSE NULL
  END,
  CASE WHEN COALESCE((item->>'pass')::boolean, false) THEN 'Pass' ELSE 'Fail' END,
  h."handover_at_utc"
FROM "fleet"."handover" h
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(h."checklist", '[]'::jsonb)) item
WHERE CASE
    WHEN lower(item->>'item') LIKE '%bod%' OR lower(item->>'item') LIKE '%glass%' THEN 'body'
    WHEN lower(item->>'item') LIKE '%tyre%' OR lower(item->>'item') LIKE '%spare%' THEN 'tyres'
    WHEN lower(item->>'item') LIKE '%light%' OR lower(item->>'item') LIKE '%indicator%' THEN 'lights'
    WHEN lower(item->>'item') LIKE '%asset%' OR lower(item->>'item') LIKE '%salik%' THEN 'assets'
    WHEN lower(item->>'item') LIKE '%cabin%' THEN 'cabin'
    ELSE NULL
  END IS NOT NULL
  AND COALESCE((item->>'pass')::boolean, false) = true
ON CONFLICT ("handover_id", "capture_phase", "item_code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "fleet"."handover_evidence" (
  "organization_id", "uploaded_by_person_id", "handover_id", "evidence_type", "status", "object_key", "content_sha256", "mime_type", "size_bytes", "signer_person_id", "captured_by_person_id", "staged_at_utc", "claimed_at_utc", "expires_at_utc"
)
SELECT h."organization_id", h."driver_person_id", h."id", 'LegacyReference', 'Claimed',
  'legacy:' || h."id"::text || ':handover-signature', repeat('0', 64), 'application/x-legacy-reference', 1,
  h."driver_person_id", h."driver_person_id", h."handover_at_utc", h."handover_at_utc", h."handover_at_utc" + interval '100 years'
FROM "fleet"."handover" h
WHERE h."handover_signature_ref" IS NOT NULL
ON CONFLICT ("object_key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "fleet"."handover_evidence" (
  "organization_id", "uploaded_by_person_id", "handover_id", "evidence_type", "status", "object_key", "content_sha256", "mime_type", "size_bytes", "signer_person_id", "captured_by_person_id", "staged_at_utc", "claimed_at_utc", "expires_at_utc"
)
SELECT h."organization_id", h."driver_person_id", h."id", 'LegacyReference', 'Claimed',
  'legacy:' || h."id"::text || ':return-signature', repeat('0', 64), 'application/x-legacy-reference', 1,
  h."driver_person_id", h."driver_person_id", COALESCE(h."return_at_utc", h."handover_at_utc"), COALESCE(h."return_at_utc", h."handover_at_utc"), COALESCE(h."return_at_utc", h."handover_at_utc") + interval '100 years'
FROM "fleet"."handover" h
WHERE h."return_signature_ref" IS NOT NULL
ON CONFLICT ("object_key") DO NOTHING;
--> statement-breakpoint
UPDATE "fleet"."handover" h
SET "key_outcome" = 'Returned'
WHERE h."phase" = 'Returned'
  AND EXISTS (
    SELECT 1 FROM "fleet"."key_log" k
    WHERE k."handover_id" = h."id" AND k."custody_state" = 'Returned'
  )
  AND h."key_outcome" IS NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "fleet"."reject_changed_completed_handover"() RETURNS trigger AS $$
BEGIN
  IF OLD."phase" = 'Returned' THEN
    RAISE EXCEPTION 'completed handover evidence is immutable; append an amendment' USING ERRCODE = '23514';
  END IF;
  IF OLD."phase" = 'Handover' AND NEW."phase" NOT IN ('Handover', 'Returned') THEN
    RAISE EXCEPTION 'invalid handover phase transition' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "handover_completed_immutable_trg" ON "fleet"."handover";
--> statement-breakpoint
CREATE TRIGGER "handover_completed_immutable_trg"
  BEFORE UPDATE ON "fleet"."handover"
  FOR EACH ROW EXECUTE FUNCTION "fleet"."reject_changed_completed_handover"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "fleet"."reject_handover_child_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'handover evidence is append-only' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "handover_inspection_no_mutate_trg" ON "fleet"."handover_inspection_item";
--> statement-breakpoint
CREATE TRIGGER "handover_inspection_no_mutate_trg"
  BEFORE UPDATE OR DELETE ON "fleet"."handover_inspection_item"
  FOR EACH ROW EXECUTE FUNCTION "fleet"."reject_handover_child_mutation"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "handover_amendment_no_mutate_trg" ON "fleet"."handover_amendment";
--> statement-breakpoint
CREATE TRIGGER "handover_amendment_no_mutate_trg"
  BEFORE UPDATE OR DELETE ON "fleet"."handover_amendment"
  FOR EACH ROW EXECUTE FUNCTION "fleet"."reject_handover_child_mutation"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "fleet"."guard_handover_evidence_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" = 'Claimed' THEN
    RAISE EXCEPTION 'claimed handover evidence is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'Claimed' THEN
    RAISE EXCEPTION 'claimed handover evidence is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "handover_evidence_claimed_immutable_trg" ON "fleet"."handover_evidence";
--> statement-breakpoint
CREATE TRIGGER "handover_evidence_claimed_immutable_trg"
  BEFORE UPDATE OR DELETE ON "fleet"."handover_evidence"
  FOR EACH ROW EXECUTE FUNCTION "fleet"."guard_handover_evidence_mutation"();
