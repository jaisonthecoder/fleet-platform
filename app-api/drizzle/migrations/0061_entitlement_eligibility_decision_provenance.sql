-- 0061 — Separate full DomainDecision provenance for Dedicated eligibility previews.
ALTER TABLE "fleet"."entitlement_eligibility_preview"
  ADD COLUMN IF NOT EXISTS "decision_provenance" jsonb;