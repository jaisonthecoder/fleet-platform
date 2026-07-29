ALTER TYPE "public"."fleet_entitlement_status" ADD VALUE IF NOT EXISTS 'ModificationRequested';
--> statement-breakpoint
ALTER TYPE "public"."fleet_entitlement_status" ADD VALUE IF NOT EXISTS 'AwaitingConsent';
--> statement-breakpoint
ALTER TYPE "public"."fleet_entitlement_status" ADD VALUE IF NOT EXISTS 'Returned';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "person_organization_id_id_uq"
  ON "fleet"."person" ("organization_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hierarchy_node_organization_id_id_uq"
  ON "fleet"."hierarchy_node" ("organization_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_organization_id_id_uq"
  ON "fleet"."vehicle" ("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request"
  ADD COLUMN IF NOT EXISTS "requested_by_person_id" uuid,
  ADD COLUMN IF NOT EXISTS "assigned_driver_person_id" uuid,
  ADD COLUMN IF NOT EXISTS "preferred_vehicle_id" uuid,
  ADD COLUMN IF NOT EXISTS "preference_note" text,
  ADD COLUMN IF NOT EXISTS "revision" integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "approval_route_provenance" jsonb,
  ADD COLUMN IF NOT EXISTS "workflow_definition_version_id" uuid;
--> statement-breakpoint
UPDATE "fleet"."entitlement_request"
SET "requested_by_person_id" = "requester_person_id"
WHERE "requested_by_person_id" IS NULL;
--> statement-breakpoint
UPDATE "fleet"."entitlement_request"
SET "assigned_driver_person_id" = "requester_person_id"
WHERE "assigned_driver_person_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request"
  ALTER COLUMN "requested_by_person_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request"
  DROP CONSTRAINT IF EXISTS "entitlement_revision_positive",
  DROP CONSTRAINT IF EXISTS "entitlement_preference_note_length",
  DROP CONSTRAINT IF EXISTS "entitlement_duration_window_valid",
  DROP CONSTRAINT IF EXISTS "entitlement_driver_option_valid",
  DROP CONSTRAINT IF EXISTS "entitlement_with_driver_requires_driver";
--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request"
  ADD CONSTRAINT "entitlement_revision_positive" CHECK ("revision" > 0),
  ADD CONSTRAINT "entitlement_preference_note_length" CHECK (char_length("preference_note") <= 500),
  ADD CONSTRAINT "entitlement_duration_window_valid" CHECK (
    "duration_start" IS NOT NULL AND "duration_end" IS NOT NULL AND "duration_end" >= "duration_start"
  ),
  ADD CONSTRAINT "entitlement_driver_option_valid" CHECK (
    "driver_option" IS NULL OR "driver_option" IN ('WithDriver', 'WithoutDriver')
  ),
  ADD CONSTRAINT "entitlement_with_driver_requires_driver" CHECK (
    "driver_option" <> 'WithDriver' OR "assigned_driver_person_id" IS NOT NULL
  );
--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request"
  DROP CONSTRAINT IF EXISTS "entitlement_requester_org_fk",
  DROP CONSTRAINT IF EXISTS "entitlement_requested_by_org_fk",
  DROP CONSTRAINT IF EXISTS "entitlement_assigned_driver_org_fk",
  DROP CONSTRAINT IF EXISTS "entitlement_location_org_fk",
  DROP CONSTRAINT IF EXISTS "entitlement_preferred_vehicle_org_fk";
--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request"
  ADD CONSTRAINT "entitlement_requester_org_fk"
    FOREIGN KEY ("organization_id", "requester_person_id")
    REFERENCES "fleet"."person" ("organization_id", "id"),
  ADD CONSTRAINT "entitlement_requested_by_org_fk"
    FOREIGN KEY ("organization_id", "requested_by_person_id")
    REFERENCES "fleet"."person" ("organization_id", "id"),
  ADD CONSTRAINT "entitlement_assigned_driver_org_fk"
    FOREIGN KEY ("organization_id", "assigned_driver_person_id")
    REFERENCES "fleet"."person" ("organization_id", "id"),
  ADD CONSTRAINT "entitlement_location_org_fk"
    FOREIGN KEY ("organization_id", "location_node_id")
    REFERENCES "fleet"."hierarchy_node" ("organization_id", "id"),
  ADD CONSTRAINT "entitlement_preferred_vehicle_org_fk"
    FOREIGN KEY ("organization_id", "preferred_vehicle_id")
    REFERENCES "fleet"."vehicle" ("organization_id", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entitlement_owner_status_idx"
  ON "fleet"."entitlement_request" ("organization_id", "requester_person_id", "status", "created_at_utc" DESC);
CREATE INDEX IF NOT EXISTS "entitlement_scope_status_idx"
  ON "fleet"."entitlement_request" ("organization_id", "location_node_id", "status");
CREATE INDEX IF NOT EXISTS "entitlement_preferred_vehicle_idx"
  ON "fleet"."entitlement_request" ("preferred_vehicle_id")
  WHERE "preferred_vehicle_id" IS NOT NULL;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "entitlement_bump_revision_trg" ON "fleet"."entitlement_request";
--> statement-breakpoint
CREATE TRIGGER "entitlement_bump_revision_trg"
BEFORE UPDATE ON "fleet"."entitlement_request"
FOR EACH ROW EXECUTE FUNCTION "fleet"."bump_revision"();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fleet"."entitlement_command_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
  "actor_person_id" uuid NOT NULL,
  "command_type" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "payload_sha256" text NOT NULL,
  "result_entitlement_id" uuid,
  "result_body" jsonb,
  "created_at_utc" timestamptz DEFAULT now() NOT NULL,
  "updated_at_utc" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "entitlement_command_payload_sha256_valid" CHECK ("payload_sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "entitlement_command_actor_org_fk" FOREIGN KEY ("organization_id", "actor_person_id")
    REFERENCES "fleet"."person" ("organization_id", "id"),
  CONSTRAINT "entitlement_command_result_fk" FOREIGN KEY ("result_entitlement_id")
    REFERENCES "fleet"."entitlement_request" ("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entitlement_command_key_uq"
  ON "fleet"."entitlement_command_ledger" ("organization_id", "actor_person_id", "command_type", "idempotency_key");
CREATE INDEX IF NOT EXISTS "entitlement_command_result_idx"
  ON "fleet"."entitlement_command_ledger" ("result_entitlement_id");