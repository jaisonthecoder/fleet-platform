ALTER TABLE "fleet"."entitlement_request" DROP CONSTRAINT IF EXISTS "entitlement_approval_suspender_org_fk";
ALTER TABLE "fleet"."booking" DROP CONSTRAINT IF EXISTS "booking_approval_suspender_org_fk";
ALTER TABLE "fleet"."entitlement_request" DROP CONSTRAINT IF EXISTS "entitlement_approval_suspension_complete_chk";
ALTER TABLE "fleet"."booking" DROP CONSTRAINT IF EXISTS "booking_approval_suspension_complete_chk";
DROP INDEX IF EXISTS "fleet"."entitlement_approval_suspension_idx";
DROP INDEX IF EXISTS "fleet"."booking_approval_suspension_idx";
ALTER TABLE "fleet"."entitlement_request" DROP COLUMN IF EXISTS "approval_suspension_reason", DROP COLUMN IF EXISTS "approval_suspended_by_person_id", DROP COLUMN IF EXISTS "approval_suspended_at_utc";
ALTER TABLE "fleet"."booking" DROP COLUMN IF EXISTS "approval_suspension_reason", DROP COLUMN IF EXISTS "approval_suspended_by_person_id", DROP COLUMN IF EXISTS "approval_suspended_at_utc";