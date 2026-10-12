-- Reverses 20260917020000_customer_status_draft_default.

ALTER TABLE "customer_group" ALTER COLUMN "status" SET DEFAULT 'onboarding';
