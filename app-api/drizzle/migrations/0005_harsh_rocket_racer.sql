CREATE TYPE "public"."fleet_vehicle_assignment_model" AS ENUM('Pool', 'Dedicated');--> statement-breakpoint
CREATE TYPE "public"."fleet_vehicle_gps_status" AS ENUM('Installed', 'NotInstalled', 'Online', 'Offline', 'Faulty', 'UnderReplacement');--> statement-breakpoint
CREATE TYPE "public"."fleet_vehicle_lifecycle_status" AS ENUM('Active', 'InUse', 'UnderMaintenance', 'OffHirePending', 'Decommissioned', 'Sold', 'Transferred');--> statement-breakpoint
CREATE TYPE "public"."fleet_vehicle_operational_status" AS ENUM('Reserve', 'Standby', 'VIPOnly', 'Quarantined', 'TemporaryHold');--> statement-breakpoint
CREATE TYPE "public"."fleet_vehicle_ownership" AS ENUM('Owned', 'Leased');--> statement-breakpoint
CREATE TABLE "fleet"."vehicle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"plate" text NOT NULL,
	"chassis_vin" text NOT NULL,
	"make_code" text,
	"model_code" text,
	"year" integer,
	"colour" text,
	"body_type_code" text NOT NULL,
	"use_category_code" text,
	"seating_capacity" integer,
	"fuel_type_code" text,
	"fuel_efficiency_kmpl" numeric(6, 2),
	"ownership" "fleet_vehicle_ownership" DEFAULT 'Owned' NOT NULL,
	"purchase_or_lease_start" date,
	"lease_end" date,
	"purchase_cost" numeric(14, 2),
	"monthly_rental" numeric(14, 2),
	"currency" text DEFAULT 'AED' NOT NULL,
	"vendor_id" uuid,
	"lease_contract_ref" text,
	"depreciation_rate" numeric(6, 3),
	"mulkiya_number" text,
	"mulkiya_expiry" date,
	"insurance_provider" text,
	"insurance_policy_number" text,
	"insurance_expiry" date,
	"insurance_coverage_type" text,
	"salik_tag" text,
	"darb_tag" text,
	"fuel_card_number" text,
	"lifecycle_status" "fleet_vehicle_lifecycle_status" DEFAULT 'Active' NOT NULL,
	"operational_status" "fleet_vehicle_operational_status",
	"booking_pool_flag" boolean DEFAULT true NOT NULL,
	"last_confirmed_odometer" numeric(12, 1),
	"next_maintenance_due" date,
	"assignment_model" "fleet_vehicle_assignment_model" DEFAULT 'Pool' NOT NULL,
	"assigned_driver_person_id" uuid,
	"tracker_vendor" text,
	"tracker_serial" text,
	"sim" text,
	"gps_status" "fleet_vehicle_gps_status" DEFAULT 'NotInstalled' NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."vehicle_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"doc_type_code" text NOT NULL,
	"issue_date" date,
	"expiry_date" date,
	"blob_ref" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."vehicle_hierarchy_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."vehicle_lifecycle_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"actor_ref" text,
	"at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."vehicle_transfer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"from_node_id" uuid,
	"to_node_id" uuid NOT NULL,
	"effective_date" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."vehicle" ADD CONSTRAINT "vehicle_assigned_driver_person_id_person_id_fk" FOREIGN KEY ("assigned_driver_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."vehicle_document" ADD CONSTRAINT "vehicle_document_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."vehicle_hierarchy_assignment" ADD CONSTRAINT "vehicle_hierarchy_assignment_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."vehicle_hierarchy_assignment" ADD CONSTRAINT "vehicle_hierarchy_assignment_node_id_hierarchy_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "fleet"."hierarchy_node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."vehicle_lifecycle_history" ADD CONSTRAINT "vehicle_lifecycle_history_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."vehicle_transfer" ADD CONSTRAINT "vehicle_transfer_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."vehicle_transfer" ADD CONSTRAINT "vehicle_transfer_from_node_id_hierarchy_node_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "fleet"."hierarchy_node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."vehicle_transfer" ADD CONSTRAINT "vehicle_transfer_to_node_id_hierarchy_node_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "fleet"."hierarchy_node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_plate_uq" ON "fleet"."vehicle" USING btree ("organization_id","plate");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_chassis_vin_uq" ON "fleet"."vehicle" USING btree ("chassis_vin");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_salik_tag_uq" ON "fleet"."vehicle" USING btree ("salik_tag") WHERE "fleet"."vehicle"."salik_tag" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_darb_tag_uq" ON "fleet"."vehicle" USING btree ("darb_tag") WHERE "fleet"."vehicle"."darb_tag" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vehicle_booking_pool_idx" ON "fleet"."vehicle" USING btree ("booking_pool_flag");--> statement-breakpoint
CREATE INDEX "vehicle_mulkiya_expiry_idx" ON "fleet"."vehicle" USING btree ("mulkiya_expiry");--> statement-breakpoint
CREATE INDEX "vehicle_insurance_expiry_idx" ON "fleet"."vehicle" USING btree ("insurance_expiry");--> statement-breakpoint
CREATE INDEX "vehicle_assigned_driver_idx" ON "fleet"."vehicle" USING btree ("assigned_driver_person_id");--> statement-breakpoint
CREATE INDEX "vehicle_document_vehicle_idx" ON "fleet"."vehicle_document" USING btree ("vehicle_id","doc_type_code","version");--> statement-breakpoint
CREATE INDEX "vehicle_hierarchy_assignment_vehicle_idx" ON "fleet"."vehicle_hierarchy_assignment" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_lifecycle_history_vehicle_idx" ON "fleet"."vehicle_lifecycle_history" USING btree ("vehicle_id","at_utc");--> statement-breakpoint
-- Hand-authored (drizzle-kit cannot emit triggers / exclusion constraints):

-- Bus / Equipment are recorded for cost reporting but are NEVER bookable.
CREATE FUNCTION "fleet"."vehicle_not_bookable_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW.body_type_code IN ('BUS', 'EQUIPMENT') THEN
    NEW.booking_pool_flag := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "vehicle_not_bookable_trg" BEFORE INSERT OR UPDATE ON "fleet"."vehicle"
  FOR EACH ROW EXECUTE FUNCTION "fleet"."vehicle_not_bookable_guard"();--> statement-breakpoint
-- A vehicle cannot have two overlapping active hierarchy assignments.
ALTER TABLE "fleet"."vehicle_hierarchy_assignment"
  ADD CONSTRAINT "vehicle_hierarchy_assignment_no_overlap"
  EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(valid_from, coalesce(valid_to, 'infinity'::timestamptz)) WITH &&
  );