ALTER TABLE "fleet"."vehicle" ADD COLUMN "lease_contract_id" uuid;
--> statement-breakpoint
ALTER TABLE "fleet"."lease_contract" DROP CONSTRAINT IF EXISTS "lease_contract_vendor_id_vendor_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_organization_id_id_uq" ON "fleet"."vendor" USING btree ("organization_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "lease_contract_organization_id_id_uq" ON "fleet"."lease_contract" USING btree ("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "fleet"."lease_contract" ADD CONSTRAINT "lease_contract_vendor_org_fk" FOREIGN KEY ("organization_id", "vendor_id") REFERENCES "fleet"."vendor"("organization_id", "id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."vehicle" ADD CONSTRAINT "vehicle_vendor_org_fk" FOREIGN KEY ("organization_id", "vendor_id") REFERENCES "fleet"."vendor"("organization_id", "id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."vehicle" ADD CONSTRAINT "vehicle_lease_contract_org_fk" FOREIGN KEY ("organization_id", "lease_contract_id") REFERENCES "fleet"."lease_contract"("organization_id", "id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "vehicle_vendor_idx" ON "fleet"."vehicle" USING btree ("vendor_id");
--> statement-breakpoint
CREATE INDEX "vehicle_lease_contract_idx" ON "fleet"."vehicle" USING btree ("lease_contract_id");