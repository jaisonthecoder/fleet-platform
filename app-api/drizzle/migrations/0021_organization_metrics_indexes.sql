CREATE INDEX "person_home_pool_node_idx" ON "fleet"."person" USING btree ("home_pool_node_id");
--> statement-breakpoint
CREATE INDEX "vehicle_hierarchy_assignment_node_idx" ON "fleet"."vehicle_hierarchy_assignment" USING btree ("node_id");