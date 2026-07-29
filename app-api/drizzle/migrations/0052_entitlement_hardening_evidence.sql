ALTER TABLE "fleet"."entitlement_request"
  ADD COLUMN IF NOT EXISTS "consent_content_hash" text;
--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request"
  ADD CONSTRAINT "entitlement_consent_content_hash_valid"
  CHECK ("consent_content_hash" IS NULL OR "consent_content_hash" ~ '^[0-9a-f]{64}$');
--> statement-breakpoint
CREATE INDEX "entitlement_preview_expiry_cleanup_idx"
  ON "fleet"."entitlement_eligibility_preview" ("expires_at_utc");