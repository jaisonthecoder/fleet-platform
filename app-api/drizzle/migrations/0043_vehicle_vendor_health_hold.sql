ALTER TYPE "public"."fleet_lease_contract_status" ADD VALUE IF NOT EXISTS 'Suspended';
--> statement-breakpoint
ALTER TABLE "fleet"."vehicle" ADD COLUMN IF NOT EXISTS "vendor_health_hold" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "fleet"."vehicle" ADD COLUMN IF NOT EXISTS "vendor_health_hold_reason" text;
--> statement-breakpoint
ALTER TABLE "fleet"."vehicle" ADD COLUMN IF NOT EXISTS "vendor_health_previous_operational_status" "public"."fleet_vehicle_operational_status";
--> statement-breakpoint
ALTER TABLE "fleet"."vehicle" ADD COLUMN IF NOT EXISTS "vendor_health_previous_booking_pool_flag" boolean;
--> statement-breakpoint
ALTER TABLE "fleet"."vehicle" ADD COLUMN IF NOT EXISTS "vendor_health_held_at_utc" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_vendor_health_hold_idx" ON "fleet"."vehicle" USING btree ("organization_id", "vendor_health_hold") WHERE "vendor_health_hold" = true;