CREATE TABLE IF NOT EXISTS "fleet"."handover_command_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
  "actor_person_id" uuid NOT NULL,
  "command_type" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "payload_sha256" text NOT NULL,
  "result_handover_id" uuid,
  "result_body" jsonb,
  "created_at_utc" timestamptz DEFAULT now() NOT NULL,
  "updated_at_utc" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "handover_command_result_fk" FOREIGN KEY ("result_handover_id") REFERENCES "fleet"."handover"("id"),
  CONSTRAINT "handover_command_actor_org_fk" FOREIGN KEY ("organization_id", "actor_person_id") REFERENCES "fleet"."person"("organization_id", "id"),
  CONSTRAINT "handover_command_payload_sha256_valid" CHECK ("payload_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "handover_command_key_uq"
  ON "fleet"."handover_command_ledger" ("organization_id", "actor_person_id", "command_type", "idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "handover_command_result_idx"
  ON "fleet"."handover_command_ledger" ("result_handover_id");
