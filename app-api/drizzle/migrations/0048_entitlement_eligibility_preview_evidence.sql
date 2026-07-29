CREATE TABLE "fleet"."entitlement_eligibility_preview" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
  "requester_person_id" uuid NOT NULL,
  "location_node_id" uuid NOT NULL,
  "request_fingerprint" text NOT NULL,
  "policy_rule_id" uuid NOT NULL,
  "policy_version_id" uuid NOT NULL,
  "policy_version" text NOT NULL,
  "decision" text NOT NULL,
  "reasons" text[] DEFAULT '{}'::text[] NOT NULL,
  "permitted_vehicle_classes" text[] DEFAULT '{}'::text[] NOT NULL,
  "eligible_vehicle_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  "evaluated_at_utc" timestamptz DEFAULT now() NOT NULL,
  "expires_at_utc" timestamptz NOT NULL,
  CONSTRAINT "entitlement_preview_request_fingerprint_valid"
    CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "entitlement_preview_decision_valid"
    CHECK ("decision" IN ('ALLOW', 'DENY')),
  CONSTRAINT "entitlement_preview_expiry_valid"
    CHECK ("expires_at_utc" > "evaluated_at_utc"),
  CONSTRAINT "entitlement_preview_requester_org_fk"
    FOREIGN KEY ("organization_id", "requester_person_id")
    REFERENCES "fleet"."person" ("organization_id", "id"),
  CONSTRAINT "entitlement_preview_location_org_fk"
    FOREIGN KEY ("organization_id", "location_node_id")
    REFERENCES "fleet"."hierarchy_node" ("organization_id", "id"),
  CONSTRAINT "entitlement_preview_policy_rule_fk"
    FOREIGN KEY ("policy_rule_id") REFERENCES "fleet"."policy_rule" ("id"),
  CONSTRAINT "entitlement_preview_policy_version_fk"
    FOREIGN KEY ("policy_version_id") REFERENCES "fleet"."policy_version" ("id")
);
--> statement-breakpoint
CREATE INDEX "entitlement_preview_requester_expiry_idx"
  ON "fleet"."entitlement_eligibility_preview" (
    "organization_id", "requester_person_id", "expires_at_utc"
  );
--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request"
  ADD COLUMN IF NOT EXISTS "eligibility_preview_id" uuid;
--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request"
  ADD CONSTRAINT "entitlement_request_eligibility_preview_fk"
  FOREIGN KEY ("eligibility_preview_id")
  REFERENCES "fleet"."entitlement_eligibility_preview" ("id");
--> statement-breakpoint
CREATE INDEX "entitlement_request_eligibility_preview_idx"
  ON "fleet"."entitlement_request" ("eligibility_preview_id")
  WHERE "eligibility_preview_id" IS NOT NULL;