CREATE TABLE "fleet"."entitlement_allocation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
  "entitlement_request_id" uuid NOT NULL,
  "vehicle_id" uuid NOT NULL,
  "allocated_by_person_id" uuid NOT NULL,
  "effective_start" date NOT NULL,
  "effective_end" date NOT NULL,
  "status" text DEFAULT 'Active' NOT NULL,
  "preferred_vehicle_id" uuid,
  "preference_honoured" boolean NOT NULL,
  "variance_reason_code" text,
  "qualification_snapshot" jsonb NOT NULL,
  "allocated_at_utc" timestamptz DEFAULT now() NOT NULL,
  "ended_at_utc" timestamptz,
  "created_at_utc" timestamptz DEFAULT now() NOT NULL,
  "updated_at_utc" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "entitlement_allocation_window_valid" CHECK ("effective_end" >= "effective_start"),
  CONSTRAINT "entitlement_allocation_status_valid" CHECK ("status" IN ('Active', 'Returned', 'Cancelled', 'Expired')),
  CONSTRAINT "entitlement_allocation_variance_required" CHECK (
    "preference_honoured" = true
    OR "preferred_vehicle_id" IS NULL
    OR nullif(btrim("variance_reason_code"), '') IS NOT NULL
  ),
  CONSTRAINT "entitlement_allocation_request_fk" FOREIGN KEY ("entitlement_request_id") REFERENCES "fleet"."entitlement_request"("id"),
  CONSTRAINT "entitlement_allocation_vehicle_org_fk" FOREIGN KEY ("organization_id", "vehicle_id") REFERENCES "fleet"."vehicle"("organization_id", "id"),
  CONSTRAINT "entitlement_allocation_allocator_org_fk" FOREIGN KEY ("organization_id", "allocated_by_person_id") REFERENCES "fleet"."person"("organization_id", "id"),
  CONSTRAINT "entitlement_allocation_preference_org_fk" FOREIGN KEY ("organization_id", "preferred_vehicle_id") REFERENCES "fleet"."vehicle"("organization_id", "id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_allocation_active_request_uq"
  ON "fleet"."entitlement_allocation" ("entitlement_request_id")
  WHERE "status" = 'Active';
--> statement-breakpoint
CREATE INDEX "entitlement_allocation_vehicle_status_idx"
  ON "fleet"."entitlement_allocation" ("organization_id", "vehicle_id", "status");
--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_allocation"
  ADD CONSTRAINT "entitlement_allocation_no_overlap"
  EXCLUDE USING gist (
    "organization_id" WITH =,
    "vehicle_id" WITH =,
    daterange("effective_start", "effective_end", '[]') WITH &&
  ) WHERE ("status" = 'Active');