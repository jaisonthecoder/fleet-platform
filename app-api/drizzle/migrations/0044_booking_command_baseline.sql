ALTER TABLE "fleet"."booking"
  ADD COLUMN "beneficiary_person_id" uuid,
  ADD COLUMN "booking_scope_node_id" uuid,
  ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "fleet"."booking"
  ADD CONSTRAINT "booking_beneficiary_person_id_person_id_fk"
  FOREIGN KEY ("beneficiary_person_id") REFERENCES "fleet"."person"("id");
--> statement-breakpoint
ALTER TABLE "fleet"."booking"
  ADD CONSTRAINT "booking_booking_scope_node_id_hierarchy_node_id_fk"
  FOREIGN KEY ("booking_scope_node_id") REFERENCES "fleet"."hierarchy_node"("id");
--> statement-breakpoint
ALTER TABLE "fleet"."booking"
  ADD CONSTRAINT "booking_revision_positive" CHECK ("revision" > 0);
--> statement-breakpoint
UPDATE "fleet"."booking"
SET "beneficiary_person_id" = "requested_by_person_id"
WHERE "requested_by_person_id" = "driver_person_id"
  AND "beneficiary_person_id" IS NULL;
--> statement-breakpoint
UPDATE "fleet"."booking" AS b
SET "booking_scope_node_id" = (
  SELECT vha."node_id"
  FROM "fleet"."vehicle_hierarchy_assignment" AS vha
  WHERE vha."vehicle_id" = b."vehicle_id"
    AND vha."valid_from" <= b."created_at_utc"
    AND (vha."valid_to" IS NULL OR vha."valid_to" > b."created_at_utc")
  ORDER BY vha."valid_from" DESC
  LIMIT 1
)
WHERE b."booking_scope_node_id" IS NULL;
--> statement-breakpoint
CREATE INDEX "booking_beneficiary_idx"
  ON "fleet"."booking" USING btree ("beneficiary_person_id");
--> statement-breakpoint
CREATE INDEX "booking_scope_status_idx"
  ON "fleet"."booking" USING btree ("booking_scope_node_id", "status");
--> statement-breakpoint
CREATE TRIGGER "booking_bump_revision_trg"
BEFORE UPDATE ON "fleet"."booking"
FOR EACH ROW EXECUTE FUNCTION "fleet"."bump_revision"();
--> statement-breakpoint
CREATE TABLE "fleet"."booking_command_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
  "actor_person_id" uuid NOT NULL,
  "command_type" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "payload_hash" text NOT NULL,
  "result_booking_id" uuid,
  "result" jsonb,
  "created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "booking_command_ledger_actor_person_id_person_id_fk"
    FOREIGN KEY ("actor_person_id") REFERENCES "fleet"."person"("id"),
  CONSTRAINT "booking_command_ledger_result_booking_id_booking_id_fk"
    FOREIGN KEY ("result_booking_id") REFERENCES "fleet"."booking"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "booking_command_ledger_key_uq"
  ON "fleet"."booking_command_ledger" USING btree (
    "organization_id", "actor_person_id", "command_type", "idempotency_key"
  );
--> statement-breakpoint
CREATE INDEX "booking_command_ledger_result_idx"
  ON "fleet"."booking_command_ledger" USING btree ("result_booking_id");
