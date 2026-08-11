-- Rollback for 0059_eligibility_decision_provenance.
DROP INDEX IF EXISTS "fleet"."eligibility_evaluation_correlation_idx";
ALTER TABLE "fleet"."eligibility_evaluation"
  DROP CONSTRAINT IF EXISTS "eligibility_evaluation_requested_scope_fk",
  DROP CONSTRAINT IF EXISTS "eligibility_evaluation_resolved_scope_fk",
  DROP CONSTRAINT IF EXISTS "eligibility_evaluation_source_classification_check";
ALTER TABLE "fleet"."eligibility_evaluation"
  DROP COLUMN IF EXISTS "source_classification",
  DROP COLUMN IF EXISTS "decision_provenance",
  DROP COLUMN IF EXISTS "correlation_id",
  DROP COLUMN IF EXISTS "fact_fingerprint",
  DROP COLUMN IF EXISTS "requested_scope_node_id",
  DROP COLUMN IF EXISTS "resolved_scope_node_id",
  DROP COLUMN IF EXISTS "effective_at_utc";