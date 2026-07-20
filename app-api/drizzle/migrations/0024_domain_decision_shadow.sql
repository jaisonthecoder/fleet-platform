CREATE TABLE "fleet"."domain_decision_comparison" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"decision_key" text NOT NULL,
	"consumer" text NOT NULL,
	"subject_ref" text NOT NULL,
	"correlation_id" text NOT NULL,
	"requested_scope_node_id" uuid,
	"mode" text NOT NULL,
	"fact_fingerprint" text NOT NULL,
	"legacy_result" jsonb,
	"new_result" jsonb,
	"category" text NOT NULL,
	"compared_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."domain_decision_comparison" ADD CONSTRAINT "domain_decision_comparison_scope_fk" FOREIGN KEY ("organization_id","requested_scope_node_id") REFERENCES "fleet"."hierarchy_node"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "domain_decision_comparison_key_idx" ON "fleet"."domain_decision_comparison" USING btree ("organization_id","decision_key","compared_at_utc");
--> statement-breakpoint
UPDATE fleet.booking
SET policy_provenance = jsonb_build_object(
  'legacy', jsonb_build_object(
    'policyVersion', coalesce(policy_version, 'unknown'),
    'requestedScopeNodeId', NULL,
    'resolvedScopeNodeId', NULL,
    'reasons', jsonb_build_array('historical-provenance-backfill')
  )
)
WHERE policy_provenance = '{}'::jsonb
  AND policy_version IS NOT NULL;