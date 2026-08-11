-- 0059 — Complete immutable provenance for structural and configurable eligibility decisions.
ALTER TABLE "fleet"."eligibility_evaluation"
  ADD COLUMN IF NOT EXISTS "source_classification" text DEFAULT 'legacy-unknown' NOT NULL,
  ADD COLUMN IF NOT EXISTS "decision_provenance" jsonb,
  ADD COLUMN IF NOT EXISTS "correlation_id" text,
  ADD COLUMN IF NOT EXISTS "fact_fingerprint" text,
  ADD COLUMN IF NOT EXISTS "requested_scope_node_id" uuid,
  ADD COLUMN IF NOT EXISTS "resolved_scope_node_id" uuid,
  ADD COLUMN IF NOT EXISTS "effective_at_utc" timestamptz;
--> statement-breakpoint
ALTER TABLE "fleet"."eligibility_evaluation"
  ADD CONSTRAINT "eligibility_evaluation_source_classification_check"
    CHECK ("source_classification" IN ('legacy-unknown','freshness','hard-block','configurable'));
--> statement-breakpoint
ALTER TABLE "fleet"."eligibility_evaluation"
  ADD CONSTRAINT "eligibility_evaluation_requested_scope_fk"
    FOREIGN KEY ("organization_id","requested_scope_node_id")
    REFERENCES "fleet"."hierarchy_node"("organization_id","id");
--> statement-breakpoint
ALTER TABLE "fleet"."eligibility_evaluation"
  ADD CONSTRAINT "eligibility_evaluation_resolved_scope_fk"
    FOREIGN KEY ("organization_id","resolved_scope_node_id")
    REFERENCES "fleet"."hierarchy_node"("organization_id","id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eligibility_evaluation_correlation_idx"
  ON "fleet"."eligibility_evaluation" ("organization_id","correlation_id");