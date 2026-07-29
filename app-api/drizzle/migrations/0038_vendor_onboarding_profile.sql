CREATE TABLE IF NOT EXISTS "fleet"."vendor_onboarding_profile" (
	"vendor_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"standard_off_hire_notice_days" integer,
	"early_termination_penalty" text,
	"renewal_options" text,
	"escalation_clause" text,
	"replacement_clause" text,
	"alert_ladder" text,
	"access_mode" text DEFAULT 'ManualInternal' NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_onboarding_profile_vendor_org_fk" FOREIGN KEY ("organization_id", "vendor_id") REFERENCES "fleet"."vendor"("organization_id", "id"),
	CONSTRAINT "vendor_onboarding_profile_notice_days_valid" CHECK ("standard_off_hire_notice_days" IS NULL OR "standard_off_hire_notice_days" >= 0),
	CONSTRAINT "vendor_onboarding_profile_access_mode_valid" CHECK ("access_mode" = 'ManualInternal')
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_onboarding_profile_org_vendor_uq" ON "fleet"."vendor_onboarding_profile" USING btree ("organization_id", "vendor_id");