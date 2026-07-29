CREATE TABLE "fleet"."workflow_definition" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
  "workflow_type" text NOT NULL,
  "definition_key" text NOT NULL,
  "created_by_person_id" uuid REFERENCES "fleet"."person"("id"),
  "created_at_utc" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_definition_key_uq" ON "fleet"."workflow_definition" ("organization_id", "workflow_type", "definition_key");
--> statement-breakpoint
CREATE TABLE "fleet"."workflow_definition_deployment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_definition_id" uuid NOT NULL REFERENCES "fleet"."workflow_definition"("id"),
  "version" integer NOT NULL CHECK ("version" > 0),
  "definition_snapshot" jsonb NOT NULL,
  "definition_sha256" text NOT NULL CHECK ("definition_sha256" ~ '^[0-9a-f]{64}$'),
  "deployed_by_person_id" uuid REFERENCES "fleet"."person"("id"),
  "deployed_at_utc" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_deployment_version_uq" ON "fleet"."workflow_definition_deployment" ("workflow_definition_id", "version");
CREATE UNIQUE INDEX "workflow_deployment_hash_uq" ON "fleet"."workflow_definition_deployment" ("workflow_definition_id", "definition_sha256");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "fleet"."reject_immutable_workflow_evidence"() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'immutable workflow evidence cannot be changed' USING ERRCODE = '23514'; END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "workflow_deployment_immutable_trg" BEFORE UPDATE OR DELETE ON "fleet"."workflow_definition_deployment" FOR EACH ROW EXECUTE FUNCTION "fleet"."reject_immutable_workflow_evidence"();
--> statement-breakpoint
ALTER TABLE "fleet"."workflow_instance" ADD COLUMN "definition_deployment_id" uuid REFERENCES "fleet"."workflow_definition_deployment"("id"), ADD COLUMN "state_version" integer DEFAULT 1 NOT NULL CHECK ("state_version" > 0);
ALTER TABLE "fleet"."workflow_step" ADD COLUMN "state_version" integer DEFAULT 1 NOT NULL CHECK ("state_version" > 0), ADD COLUMN "owner_kind" text, ADD COLUMN "owner_key" text, ADD COLUMN "due_at_utc" timestamptz, ADD COLUMN "escalated_at_utc" timestamptz, ADD CONSTRAINT "workflow_step_owner_pair" CHECK (("owner_kind" IS NULL) = ("owner_key" IS NULL));
CREATE INDEX "workflow_step_owner_due_idx" ON "fleet"."workflow_step" ("owner_kind", "owner_key", "due_at_utc");
CREATE OR REPLACE FUNCTION "fleet"."reject_changed_workflow_decision"() RETURNS trigger AS $$
BEGIN
  IF OLD."decision" IS NOT NULL AND (
    NEW."decision" IS DISTINCT FROM OLD."decision" OR
    NEW."decided_by_person_id" IS DISTINCT FROM OLD."decided_by_person_id" OR
    NEW."on_behalf_of_person_id" IS DISTINCT FROM OLD."on_behalf_of_person_id" OR
    NEW."reason" IS DISTINCT FROM OLD."reason" OR
    NEW."decided_at" IS DISTINCT FROM OLD."decided_at"
  ) THEN
    RAISE EXCEPTION 'workflow decision evidence cannot be changed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "workflow_step_decision_immutable_trg" BEFORE UPDATE ON "fleet"."workflow_step" FOR EACH ROW EXECUTE FUNCTION "fleet"."reject_changed_workflow_decision"();
--> statement-breakpoint
INSERT INTO "fleet"."workflow_definition" ("organization_id", "workflow_type", "definition_key")
SELECT DISTINCT "organization_id", "workflow_type", 'legacy-migrated' FROM "fleet"."workflow_instance" ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "fleet"."workflow_definition_deployment" ("workflow_definition_id", "version", "definition_snapshot", "definition_sha256")
SELECT d.id, 1, jsonb_build_object('migratedLegacy', true, 'workflowType', d.workflow_type), encode(digest(jsonb_build_object('migratedLegacy', true, 'workflowType', d.workflow_type)::text, 'sha256'), 'hex')
FROM "fleet"."workflow_definition" d WHERE d.definition_key = 'legacy-migrated' ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "fleet"."workflow_instance" wi SET "definition_deployment_id" = dd.id FROM "fleet"."workflow_definition" d JOIN "fleet"."workflow_definition_deployment" dd ON dd.workflow_definition_id = d.id WHERE wi.organization_id = d.organization_id AND wi.workflow_type = d.workflow_type AND d.definition_key = 'legacy-migrated' AND wi.definition_deployment_id IS NULL;
--> statement-breakpoint
CREATE TABLE "fleet"."booking_approval_route" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
  "booking_id" uuid NOT NULL REFERENCES "fleet"."booking"("id"),
  "workflow_instance_id" uuid NOT NULL REFERENCES "fleet"."workflow_instance"("id"),
  "definition_deployment_id" uuid NOT NULL REFERENCES "fleet"."workflow_definition_deployment"("id"),
  "created_at_utc" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "booking_approval_route_booking_idx" ON "fleet"."booking_approval_route" ("booking_id", "created_at_utc");
CREATE UNIQUE INDEX "booking_approval_route_workflow_uq" ON "fleet"."booking_approval_route" ("workflow_instance_id");
--> statement-breakpoint
CREATE TABLE "fleet"."booking_approval_route_step" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "route_id" uuid NOT NULL REFERENCES "fleet"."booking_approval_route"("id"),
  "workflow_step_id" uuid NOT NULL REFERENCES "fleet"."workflow_step"("id"),
  "step_key" text NOT NULL,
  "ordinal" integer NOT NULL CHECK ("ordinal" > 0),
  "required_approver_person_id" uuid NOT NULL REFERENCES "fleet"."person"("id"),
  "assignment_selector_snapshot" jsonb NOT NULL,
  "sla_due_at_utc" timestamptz
);
CREATE UNIQUE INDEX "booking_route_step_ordinal_uq" ON "fleet"."booking_approval_route_step" ("route_id", "ordinal");
CREATE UNIQUE INDEX "booking_route_step_key_uq" ON "fleet"."booking_approval_route_step" ("route_id", "step_key");
CREATE UNIQUE INDEX "booking_route_step_workflow_uq" ON "fleet"."booking_approval_route_step" ("workflow_step_id");
CREATE TRIGGER "booking_route_immutable_trg" BEFORE UPDATE OR DELETE ON "fleet"."booking_approval_route" FOR EACH ROW EXECUTE FUNCTION "fleet"."reject_immutable_workflow_evidence"();
CREATE TRIGGER "booking_route_step_immutable_trg" BEFORE UPDATE OR DELETE ON "fleet"."booking_approval_route_step" FOR EACH ROW EXECUTE FUNCTION "fleet"."reject_immutable_workflow_evidence"();
--> statement-breakpoint
CREATE TABLE "fleet"."workflow_decision_command" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
  "workflow_instance_id" uuid NOT NULL REFERENCES "fleet"."workflow_instance"("id"),
  "workflow_step_id" uuid NOT NULL REFERENCES "fleet"."workflow_step"("id"),
  "idempotency_key" text NOT NULL,
  "request_sha256" text NOT NULL CHECK ("request_sha256" ~ '^[0-9a-f]{64}$'),
  "decision" text NOT NULL,
  "principal_person_id" uuid NOT NULL REFERENCES "fleet"."person"("id"),
  "acting_for_person_id" uuid REFERENCES "fleet"."person"("id"),
  "result_booking_id" uuid REFERENCES "fleet"."booking"("id"),
  "result_body" jsonb,
  "created_at_utc" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "workflow_decision_command_key_uq" ON "fleet"."workflow_decision_command" ("organization_id", "principal_person_id", "idempotency_key");
CREATE INDEX "workflow_decision_command_workflow_idx" ON "fleet"."workflow_decision_command" ("workflow_instance_id", "workflow_step_id");