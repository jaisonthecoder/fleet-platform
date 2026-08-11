-- 0060 — Organization-bound idempotency for pending critical work/escalations.
CREATE UNIQUE INDEX IF NOT EXISTS "scheduled_work_pending_subject_uq"
  ON "fleet"."scheduled_work" ("organization_id","work_type","subject_ref")
  WHERE "status" = 'Pending';