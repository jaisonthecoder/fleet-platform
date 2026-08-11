-- 0063 — Reversible approver hold before Pool custody or Dedicated allocation.
ALTER TABLE "fleet"."booking"
  ADD COLUMN IF NOT EXISTS "approval_suspended_at_utc" timestamptz,
  ADD COLUMN IF NOT EXISTS "approval_suspended_by_person_id" uuid,
  ADD COLUMN IF NOT EXISTS "approval_suspension_reason" text;

ALTER TABLE "fleet"."entitlement_request"
  ADD COLUMN IF NOT EXISTS "approval_suspended_at_utc" timestamptz,
  ADD COLUMN IF NOT EXISTS "approval_suspended_by_person_id" uuid,
  ADD COLUMN IF NOT EXISTS "approval_suspension_reason" text;

ALTER TABLE "fleet"."booking"
  ADD CONSTRAINT "booking_approval_suspension_complete_chk" CHECK (
    (approval_suspended_at_utc IS NULL AND approval_suspended_by_person_id IS NULL AND approval_suspension_reason IS NULL)
    OR
    (approval_suspended_at_utc IS NOT NULL AND approval_suspended_by_person_id IS NOT NULL AND char_length(trim(approval_suspension_reason)) BETWEEN 1 AND 500)
  );

ALTER TABLE "fleet"."entitlement_request"
  ADD CONSTRAINT "entitlement_approval_suspension_complete_chk" CHECK (
    (approval_suspended_at_utc IS NULL AND approval_suspended_by_person_id IS NULL AND approval_suspension_reason IS NULL)
    OR
    (approval_suspended_at_utc IS NOT NULL AND approval_suspended_by_person_id IS NOT NULL AND char_length(trim(approval_suspension_reason)) BETWEEN 1 AND 500)
  );

ALTER TABLE "fleet"."booking"
  ADD CONSTRAINT "booking_approval_suspender_org_fk" FOREIGN KEY ("organization_id", "approval_suspended_by_person_id")
  REFERENCES "fleet"."person" ("organization_id", "id");

ALTER TABLE "fleet"."entitlement_request"
  ADD CONSTRAINT "entitlement_approval_suspender_org_fk" FOREIGN KEY ("organization_id", "approval_suspended_by_person_id")
  REFERENCES "fleet"."person" ("organization_id", "id");

CREATE INDEX IF NOT EXISTS "booking_approval_suspension_idx"
  ON "fleet"."booking" ("organization_id", "approval_suspended_at_utc")
  WHERE "approval_suspended_at_utc" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "entitlement_approval_suspension_idx"
  ON "fleet"."entitlement_request" ("organization_id", "approval_suspended_at_utc")
  WHERE "approval_suspended_at_utc" IS NOT NULL;