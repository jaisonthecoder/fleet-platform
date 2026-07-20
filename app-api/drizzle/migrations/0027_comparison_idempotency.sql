DELETE FROM fleet.domain_decision_comparison a
USING fleet.domain_decision_comparison b
WHERE a.id > b.id
  AND a.organization_id = b.organization_id
  AND a.environment = b.environment
  AND a.decision_key = b.decision_key
  AND a.consumer = b.consumer
  AND a.correlation_id = b.correlation_id
  AND a.fact_fingerprint = b.fact_fingerprint;
--> statement-breakpoint
CREATE UNIQUE INDEX "domain_decision_comparison_request_uq" ON "fleet"."domain_decision_comparison" USING btree ("organization_id","environment","decision_key","consumer","correlation_id","fact_fingerprint");