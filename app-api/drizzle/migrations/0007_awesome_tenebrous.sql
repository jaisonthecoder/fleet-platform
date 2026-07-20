CREATE TYPE "public"."fleet_device_status" AS ENUM('Registered', 'Active', 'Faulty', 'UnderReplacement', 'Retired');--> statement-breakpoint
CREATE TYPE "public"."fleet_telematics_alert_type" AS ENUM('Unplug', 'Tamper', 'DeviceSilent');--> statement-breakpoint
CREATE TABLE "fleet"."device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"identifier" text NOT NULL,
	"model" text,
	"firmware" text,
	"sim" text,
	"status" "fleet_device_status" DEFAULT 'Registered' NOT NULL,
	"last_health_at" timestamp with time zone,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."device_pairing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"device_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."telematics_alert" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"vehicle_id" uuid,
	"device_id" uuid,
	"alert_type" "fleet_telematics_alert_type" NOT NULL,
	"detail" text,
	"raised_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fleet"."trip" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"device_id" uuid,
	"booking_id" uuid,
	"driver_person_id" uuid,
	"attribution_basis" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"distance_km" numeric(10, 2),
	"start_odometer" numeric(12, 1),
	"end_odometer" numeric(12, 1),
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."device_pairing" ADD CONSTRAINT "device_pairing_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "fleet"."device"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."device_pairing" ADD CONSTRAINT "device_pairing_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."telematics_alert" ADD CONSTRAINT "telematics_alert_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."telematics_alert" ADD CONSTRAINT "telematics_alert_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "fleet"."device"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."trip" ADD CONSTRAINT "trip_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."trip" ADD CONSTRAINT "trip_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "fleet"."device"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_identifier_uq" ON "fleet"."device" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "device_pairing_device_idx" ON "fleet"."device_pairing" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_pairing_vehicle_idx" ON "fleet"."device_pairing" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "telematics_alert_vehicle_idx" ON "fleet"."telematics_alert" USING btree ("vehicle_id","raised_at");--> statement-breakpoint
CREATE INDEX "trip_vehicle_idx" ON "fleet"."trip" USING btree ("vehicle_id","started_at");--> statement-breakpoint
CREATE INDEX "trip_booking_idx" ON "fleet"."trip" USING btree ("booking_id");--> statement-breakpoint
-- Hand-authored: a device cannot be actively paired to two vehicles at once.
ALTER TABLE "fleet"."device_pairing"
  ADD CONSTRAINT "device_pairing_no_overlap"
  EXCLUDE USING gist (
    device_id WITH =,
    tstzrange(valid_from, coalesce(valid_to, 'infinity'::timestamptz)) WITH &&
  );