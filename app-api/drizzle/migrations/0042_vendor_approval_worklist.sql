ALTER TABLE "fleet"."vendor" ADD COLUMN IF NOT EXISTS "submitted_at_utc" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_pending_approval_submitted_idx" ON "fleet"."vendor" USING btree ("organization_id", "submitted_at_utc") WHERE "status" = 'PendingApproval';