CREATE TABLE IF NOT EXISTS "fleet"."consent_template" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
  "domain" text NOT NULL,
  "version" text NOT NULL,
  "status" text DEFAULT 'Draft' NOT NULL,
  "content_en" text NOT NULL,
  "content_ar" text NOT NULL,
  "content_sha256" text NOT NULL,
  "effective_at_utc" timestamptz NOT NULL,
  "created_by_person_id" uuid NOT NULL,
  "activated_by_person_id" uuid,
  "activated_at_utc" timestamptz,
  "retired_by_person_id" uuid,
  "retired_at_utc" timestamptz,
  "created_at_utc" timestamptz DEFAULT now() NOT NULL,
  "updated_at_utc" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "consent_template_domain_valid" CHECK ("domain" IN ('Booking', 'DedicatedVehicle')),
  CONSTRAINT "consent_template_status_valid" CHECK ("status" IN ('Draft', 'Active', 'Retired')),
  CONSTRAINT "consent_template_content_present" CHECK (length(trim("content_en")) > 0 AND length(trim("content_ar")) > 0),
  CONSTRAINT "consent_template_hash_valid" CHECK ("content_sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "consent_template_created_actor_org_fk" FOREIGN KEY ("organization_id", "created_by_person_id") REFERENCES "fleet"."person"("organization_id", "id"),
  CONSTRAINT "consent_template_activated_actor_org_fk" FOREIGN KEY ("organization_id", "activated_by_person_id") REFERENCES "fleet"."person"("organization_id", "id"),
  CONSTRAINT "consent_template_retired_actor_org_fk" FOREIGN KEY ("organization_id", "retired_by_person_id") REFERENCES "fleet"."person"("organization_id", "id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consent_template_version_uq"
  ON "fleet"."consent_template" ("organization_id", "domain", "version");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consent_template_active_uq"
  ON "fleet"."consent_template" ("organization_id", "domain") WHERE "status" = 'Active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_template_domain_status_idx"
  ON "fleet"."consent_template" ("organization_id", "domain", "status", "effective_at_utc");
