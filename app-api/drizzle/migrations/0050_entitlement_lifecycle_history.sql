ALTER TABLE "fleet"."entitlement_request"
  ADD COLUMN IF NOT EXISTS "renewed_from_entitlement_id" uuid;
--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request"
  ADD CONSTRAINT "entitlement_request_renewed_from_fk"
  FOREIGN KEY ("renewed_from_entitlement_id") REFERENCES "fleet"."entitlement_request"("id");
--> statement-breakpoint
CREATE INDEX "entitlement_request_renewal_lineage_idx"
  ON "fleet"."entitlement_request" ("renewed_from_entitlement_id")
  WHERE "renewed_from_entitlement_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "fleet"."entitlement_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
  "entitlement_request_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "actor_person_id" uuid,
  "reason" text,
  "detail" jsonb,
  "at_utc" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "entitlement_event_request_fk" FOREIGN KEY ("entitlement_request_id") REFERENCES "fleet"."entitlement_request"("id"),
  CONSTRAINT "entitlement_event_actor_org_fk" FOREIGN KEY ("organization_id", "actor_person_id") REFERENCES "fleet"."person"("organization_id", "id")
);
--> statement-breakpoint
CREATE INDEX "entitlement_event_request_time_idx"
  ON "fleet"."entitlement_event" ("entitlement_request_id", "at_utc");