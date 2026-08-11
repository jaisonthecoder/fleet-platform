-- 0058 — Bounded retention scan for privacy-minimized domain decision comparisons.
CREATE INDEX IF NOT EXISTS "domain_decision_comparison_retention_idx"
  ON "fleet"."domain_decision_comparison" ("compared_at_utc");