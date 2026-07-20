ALTER TABLE "fleet"."domain_decision_comparison" ADD COLUMN "resolved_scope_node_id" uuid;
--> statement-breakpoint
ALTER TABLE "fleet"."domain_decision_comparison" ADD COLUMN "legacy_policy_version" text;
--> statement-breakpoint
ALTER TABLE "fleet"."domain_decision_comparison" ADD COLUMN "new_policy_version" text;
--> statement-breakpoint
ALTER TABLE "fleet"."domain_decision_comparison" ADD COLUMN "legacy_error_code" text;
--> statement-breakpoint
ALTER TABLE "fleet"."domain_decision_comparison" ADD COLUMN "new_error_code" text;
--> statement-breakpoint
ALTER TABLE "fleet"."domain_decision_comparison" ADD CONSTRAINT "domain_decision_comparison_resolved_scope_fk" FOREIGN KEY ("organization_id","resolved_scope_node_id") REFERENCES "fleet"."hierarchy_node"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "fleet"."domain_decision_selector" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"decision_key" text NOT NULL,
	"scope_node_id" uuid,
	"mode" text DEFAULT 'legacy-only' NOT NULL,
	"canary_percentage" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."domain_decision_selector" ADD CONSTRAINT "domain_decision_selector_scope_fk" FOREIGN KEY ("organization_id","scope_node_id") REFERENCES "fleet"."hierarchy_node"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "domain_decision_selector_org_key_scope_uq" ON "fleet"."domain_decision_selector" USING btree ("organization_id","decision_key",COALESCE("scope_node_id", '00000000-0000-0000-0000-000000000000'::uuid));
--> statement-breakpoint
ALTER TABLE "fleet"."domain_decision_selector" ADD CONSTRAINT "domain_decision_selector_canary_range" CHECK ("canary_percentage" >= 0 AND "canary_percentage" <= 100);
--> statement-breakpoint
UPDATE fleet.booking
SET policy_provenance = jsonb_build_object(
  'legacy', jsonb_build_object(
    'policyVersion', 'unknown',
    'requestedScopeNodeId', NULL,
    'resolvedScopeNodeId', NULL,
    'reasons', jsonb_build_array('historical-provenance-unknown','policy-version-not-recorded')
  )
)
WHERE policy_provenance = '{}'::jsonb;