-- Audit chain hardening (P0-R2-1): link and verify the hash chain by a per-org
-- monotonic `chain_seq` assigned inside the trigger under the advisory lock,
-- NOT by the bigserial `id` (which is assigned before the trigger fires and can
-- diverge from commit order under concurrency, producing false chain forks).

-- 1) Add the column nullable so the backfill can run on existing rows.
ALTER TABLE "fleet"."audit_log" ADD COLUMN "chain_seq" bigint;--> statement-breakpoint

-- 2) Backfill existing rows (append-only guard temporarily disabled for the
--    one-off migration). Legacy rows are ordered by id per org; fresh installs
--    have no rows so this is a no-op there.
ALTER TABLE "fleet"."audit_log" DISABLE TRIGGER "audit_log_no_mutate_trg";--> statement-breakpoint
WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY organization_id ORDER BY id) AS rn
  FROM "fleet"."audit_log"
)
UPDATE "fleet"."audit_log" a
  SET "chain_seq" = ordered.rn
  FROM ordered
  WHERE a.id = ordered.id;--> statement-breakpoint
ALTER TABLE "fleet"."audit_log" ENABLE TRIGGER "audit_log_no_mutate_trg";--> statement-breakpoint

-- 3) Enforce the invariant now that every row has a value.
ALTER TABLE "fleet"."audit_log" ALTER COLUMN "chain_seq" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_log_org_chain_seq_uq" ON "fleet"."audit_log" USING btree ("organization_id","chain_seq");--> statement-breakpoint

-- 4) Redefine the hash-chain trigger: assign chain_seq under the per-org
--    advisory lock and link to the previous row BY chain_seq (commit order).
CREATE OR REPLACE FUNCTION "fleet"."audit_log_hash_chain"() RETURNS trigger AS $$
DECLARE
  v_prev bytea;
  v_prev_seq bigint;
  v_payload text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text, 0));
  SELECT row_hash, chain_seq INTO v_prev, v_prev_seq FROM fleet.audit_log
    WHERE organization_id = NEW.organization_id
    ORDER BY chain_seq DESC LIMIT 1;
  NEW.chain_seq := coalesce(v_prev_seq, 0) + 1;
  v_payload := concat_ws('|', NEW.organization_id::text, NEW.actor_ref, NEW.action,
    NEW.entity_ref, NEW.before_json::text, NEW.after_json::text, NEW.reason);
  NEW.prev_hash := v_prev;
  NEW.row_hash := digest(coalesce(v_prev, ''::bytea) || convert_to(v_payload, 'UTF8'), 'sha256');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;