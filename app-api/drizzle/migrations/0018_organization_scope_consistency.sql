CREATE UNIQUE INDEX "hierarchy_node_org_id_uq" ON "fleet"."hierarchy_node" USING btree ("organization_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "person_org_id_uq" ON "fleet"."person" USING btree ("organization_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_org_id_uq" ON "fleet"."vehicle" USING btree ("organization_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "hierarchy_one_active_root_uq" ON "fleet"."hierarchy_node" USING btree ("organization_id") WHERE "parent_id" IS NULL AND "valid_to" IS NULL;
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD CONSTRAINT "hierarchy_parent_same_org_fk" FOREIGN KEY ("organization_id","parent_id") REFERENCES "fleet"."hierarchy_node"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."person" ADD CONSTRAINT "person_home_scope_same_org_fk" FOREIGN KEY ("organization_id","home_pool_node_id") REFERENCES "fleet"."hierarchy_node"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."role_assignment" ADD CONSTRAINT "role_person_same_org_fk" FOREIGN KEY ("organization_id","person_id") REFERENCES "fleet"."person"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."role_assignment" ADD CONSTRAINT "role_scope_same_org_fk" FOREIGN KEY ("organization_id","scope_node_id") REFERENCES "fleet"."hierarchy_node"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."vehicle_hierarchy_assignment" ADD CONSTRAINT "vehicle_assignment_vehicle_same_org_fk" FOREIGN KEY ("organization_id","vehicle_id") REFERENCES "fleet"."vehicle"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."vehicle_hierarchy_assignment" ADD CONSTRAINT "vehicle_assignment_scope_same_org_fk" FOREIGN KEY ("organization_id","node_id") REFERENCES "fleet"."hierarchy_node"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request" ADD CONSTRAINT "entitlement_requester_same_org_fk" FOREIGN KEY ("organization_id","requester_person_id") REFERENCES "fleet"."person"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request" ADD CONSTRAINT "entitlement_location_same_org_fk" FOREIGN KEY ("organization_id","location_node_id") REFERENCES "fleet"."hierarchy_node"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."policy_rule" ADD CONSTRAINT "policy_scope_same_org_fk" FOREIGN KEY ("organization_id","scope_node_id") REFERENCES "fleet"."hierarchy_node"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."role_assignment" ADD CONSTRAINT "role_assignment_valid_window" CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from");
--> statement-breakpoint
ALTER TABLE "fleet"."vehicle_hierarchy_assignment" ADD CONSTRAINT "vehicle_assignment_valid_window" CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from");
--> statement-breakpoint
ALTER TABLE "fleet"."delegation" ADD CONSTRAINT "delegation_valid_window" CHECK ("valid_to" > "valid_from");