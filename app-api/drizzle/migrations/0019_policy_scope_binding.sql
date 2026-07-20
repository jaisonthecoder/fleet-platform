DROP INDEX IF EXISTS "fleet"."policy_draft_org_rule_uq";
--> statement-breakpoint
ALTER TABLE "fleet"."policy_draft" ADD COLUMN "scope_node_id" uuid;
--> statement-breakpoint
ALTER TABLE "fleet"."policy_draft" ADD CONSTRAINT "policy_draft_scope_node_id_hierarchy_node_id_fk" FOREIGN KEY ("scope_node_id") REFERENCES "fleet"."hierarchy_node"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."policy_draft" ADD CONSTRAINT "policy_draft_scope_same_org_fk" FOREIGN KEY ("organization_id","scope_node_id") REFERENCES "fleet"."hierarchy_node"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "policy_draft_org_rule_scope_uq" ON "fleet"."policy_draft" USING btree ("organization_id","rule_type",COALESCE("scope_node_id", '00000000-0000-0000-0000-000000000000'::uuid));
--> statement-breakpoint
CREATE UNIQUE INDEX "policy_active_org_rule_scope_uq" ON "fleet"."policy_rule" USING btree ("organization_id","rule_type",COALESCE("scope_node_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "status" = 'Active';