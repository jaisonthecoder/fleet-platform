DROP INDEX IF EXISTS "fleet"."domain_decision_selector_org_key_scope_uq";
--> statement-breakpoint
ALTER TABLE "fleet"."domain_decision_comparison" ADD COLUMN "environment" text DEFAULT 'default' NOT NULL;
--> statement-breakpoint
ALTER TABLE "fleet"."domain_decision_selector" ADD COLUMN "environment" text DEFAULT 'default' NOT NULL;
--> statement-breakpoint
ALTER TABLE "fleet"."domain_decision_selector" ADD COLUMN "comparison_sample_percentage" integer DEFAULT 100 NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "domain_decision_selector_org_env_key_scope_uq" ON "fleet"."domain_decision_selector" USING btree ("organization_id","environment","decision_key",COALESCE("scope_node_id", '00000000-0000-0000-0000-000000000000'::uuid));
--> statement-breakpoint
ALTER TABLE "fleet"."domain_decision_selector" ADD CONSTRAINT "domain_decision_selector_sample_range" CHECK ("comparison_sample_percentage" >= 0 AND "comparison_sample_percentage" <= 100);