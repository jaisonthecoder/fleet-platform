CREATE TABLE "fleet"."policy_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"rule_type" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"authored_definition" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "policy_draft_org_rule_uq" ON "fleet"."policy_draft" USING btree ("organization_id","rule_type");
--> statement-breakpoint
CREATE INDEX "policy_draft_rule_idx" ON "fleet"."policy_draft" USING btree ("rule_type");
--> statement-breakpoint
CREATE INDEX "policy_draft_updated_idx" ON "fleet"."policy_draft" USING btree ("updated_at_utc");