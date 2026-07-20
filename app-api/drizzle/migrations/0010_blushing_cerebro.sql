CREATE TYPE "public"."fleet_damage_state" AS ENUM('existing', 'new');--> statement-breakpoint
CREATE TYPE "public"."fleet_handover_phase" AS ENUM('Handover', 'Returned');--> statement-breakpoint
CREATE TYPE "public"."fleet_key_custody" AS ENUM('Issued', 'Returned');--> statement-breakpoint
CREATE TABLE "fleet"."damage_pin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handover_id" uuid NOT NULL,
	"x" numeric(6, 5) NOT NULL,
	"y" numeric(6, 5) NOT NULL,
	"region" text NOT NULL,
	"template_version" integer DEFAULT 1 NOT NULL,
	"photo_ref" text,
	"note" text,
	"state" "fleet_damage_state" DEFAULT 'new' NOT NULL,
	"at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."handover" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"booking_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"driver_person_id" uuid NOT NULL,
	"phase" "fleet_handover_phase" DEFAULT 'Handover' NOT NULL,
	"handover_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"start_odometer" numeric(12, 1),
	"start_fuel_eighths" integer,
	"gps_status" text,
	"key_issue_ref" text,
	"handover_signature_ref" text,
	"checklist" jsonb,
	"offline_captured" boolean DEFAULT false NOT NULL,
	"return_at_utc" timestamp with time zone,
	"end_odometer" numeric(12, 1),
	"end_fuel_eighths" integer,
	"return_condition" text,
	"key_return_ref" text,
	"return_signature_ref" text,
	"expected_fuel_consumed_litres" numeric(10, 2),
	"actual_fuel_consumed_litres" numeric(10, 2),
	"fuel_deviation_percent" numeric(6, 2),
	"fuel_deviation_flagged" boolean DEFAULT false NOT NULL,
	"odometer_conflict" boolean DEFAULT false NOT NULL,
	"telematics_odometer" numeric(12, 1),
	"late_return" boolean DEFAULT false NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."key_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"handover_id" uuid,
	"custody_state" "fleet_key_custody" NOT NULL,
	"key_ref" text,
	"person_id" uuid,
	"at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."damage_pin" ADD CONSTRAINT "damage_pin_handover_id_handover_id_fk" FOREIGN KEY ("handover_id") REFERENCES "fleet"."handover"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."handover" ADD CONSTRAINT "handover_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "fleet"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."handover" ADD CONSTRAINT "handover_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."handover" ADD CONSTRAINT "handover_driver_person_id_person_id_fk" FOREIGN KEY ("driver_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."key_log" ADD CONSTRAINT "key_log_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."key_log" ADD CONSTRAINT "key_log_handover_id_handover_id_fk" FOREIGN KEY ("handover_id") REFERENCES "fleet"."handover"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."key_log" ADD CONSTRAINT "key_log_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "damage_pin_handover_idx" ON "fleet"."damage_pin" USING btree ("handover_id");--> statement-breakpoint
CREATE UNIQUE INDEX "handover_booking_uq" ON "fleet"."handover" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "handover_vehicle_idx" ON "fleet"."handover" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "key_log_vehicle_idx" ON "fleet"."key_log" USING btree ("vehicle_id","at_utc");