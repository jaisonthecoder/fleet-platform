ALTER TABLE "fleet"."decision_log" ADD COLUMN "requested_scope_node_id" uuid;
--> statement-breakpoint
ALTER TABLE "fleet"."decision_log" ADD COLUMN "resolved_scope_node_id" uuid;
--> statement-breakpoint
ALTER TABLE "fleet"."decision_log" ADD CONSTRAINT "decision_log_requested_scope_fk" FOREIGN KEY ("organization_id","requested_scope_node_id") REFERENCES "fleet"."hierarchy_node"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."decision_log" ADD CONSTRAINT "decision_log_resolved_scope_fk" FOREIGN KEY ("organization_id","resolved_scope_node_id") REFERENCES "fleet"."hierarchy_node"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "decision_log_requested_scope_idx" ON "fleet"."decision_log" USING btree ("organization_id","requested_scope_node_id","evaluated_at_utc");