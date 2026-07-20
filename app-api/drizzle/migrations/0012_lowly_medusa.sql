CREATE TYPE "public"."fleet_black_point_status" AS ENUM('Open', 'Transferred', 'Overdue');--> statement-breakpoint
CREATE TYPE "public"."fleet_fine_status" AS ENUM('Recorded', 'Attributed', 'Disputed', 'Recovered', 'Closed');--> statement-breakpoint
CREATE TABLE "fleet"."accident" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"booking_id" uuid,
	"attributed_person_id" uuid,
	"attribution_basis" text NOT NULL,
	"occurred_at_utc" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"severity" text,
	"status" text DEFAULT 'Open' NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."black_point" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"subject_person_id" uuid NOT NULL,
	"fine_id" uuid,
	"points" integer NOT NULL,
	"transfer_deadline" timestamp with time zone,
	"transfer_status" "fleet_black_point_status" DEFAULT 'Open' NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."fine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"booking_id" uuid,
	"attributed_person_id" uuid,
	"attribution_basis" text NOT NULL,
	"event_time_utc" timestamp with time zone NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"authority" text NOT NULL,
	"external_ref" text,
	"status" "fleet_fine_status" DEFAULT 'Recorded' NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."recovery_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"fine_id" uuid NOT NULL,
	"person_id" uuid,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"note" text,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."substitution_window" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"substitute_person_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."accident" ADD CONSTRAINT "accident_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."accident" ADD CONSTRAINT "accident_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "fleet"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."accident" ADD CONSTRAINT "accident_attributed_person_id_person_id_fk" FOREIGN KEY ("attributed_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."black_point" ADD CONSTRAINT "black_point_subject_person_id_person_id_fk" FOREIGN KEY ("subject_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."black_point" ADD CONSTRAINT "black_point_fine_id_fine_id_fk" FOREIGN KEY ("fine_id") REFERENCES "fleet"."fine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."fine" ADD CONSTRAINT "fine_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."fine" ADD CONSTRAINT "fine_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "fleet"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."fine" ADD CONSTRAINT "fine_attributed_person_id_person_id_fk" FOREIGN KEY ("attributed_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."recovery_record" ADD CONSTRAINT "recovery_record_fine_id_fine_id_fk" FOREIGN KEY ("fine_id") REFERENCES "fleet"."fine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."recovery_record" ADD CONSTRAINT "recovery_record_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."substitution_window" ADD CONSTRAINT "substitution_window_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."substitution_window" ADD CONSTRAINT "substitution_window_substitute_person_id_person_id_fk" FOREIGN KEY ("substitute_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accident_vehicle_idx" ON "fleet"."accident" USING btree ("vehicle_id","occurred_at_utc");--> statement-breakpoint
CREATE INDEX "black_point_subject_idx" ON "fleet"."black_point" USING btree ("subject_person_id","transfer_status");--> statement-breakpoint
CREATE INDEX "fine_vehicle_idx" ON "fleet"."fine" USING btree ("vehicle_id","event_time_utc");--> statement-breakpoint
CREATE INDEX "fine_attributed_person_idx" ON "fleet"."fine" USING btree ("attributed_person_id","event_time_utc");--> statement-breakpoint
CREATE INDEX "recovery_record_fine_idx" ON "fleet"."recovery_record" USING btree ("fine_id");--> statement-breakpoint
CREATE INDEX "substitution_window_vehicle_idx" ON "fleet"."substitution_window" USING btree ("vehicle_id","window_start");